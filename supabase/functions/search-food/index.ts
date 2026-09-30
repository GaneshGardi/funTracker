const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

const USDA_API_URL =
  'https://api.nal.usda.gov/fdc/v1/foods/search';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          error: 'Method not allowed',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const body = await req.json();
    const query = body?.query?.trim();

    if (!query) {
      return new Response(
        JSON.stringify({
          error: 'Search query is required',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const apiKey = Deno.env.get('USDA_API_KEY');

    if (!apiKey) {
      console.error(
        'USDA_API_KEY is not configured'
      );

      return new Response(
        JSON.stringify({
          error: 'USDA API key is not configured',
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const url = new URL(USDA_API_URL);

    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '20');

    const response = await fetch(
      url.toString()
    );

    if (!response.ok) {
      const errorText = await response.text();

      console.error(
        'USDA API error:',
        response.status,
        errorText
      );

      return new Response(
        JSON.stringify({
          error:
            'Food database request failed',
        }),
        {
          status: 502,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    const data = await response.json();

    const foods = (data.foods ?? []).map(
      (food: any) => {
        const nutrients =
          food.foodNutrients ?? [];

        const getNutrient = (
          names: string[]
        ) => {
          const nutrient =
            nutrients.find((item: any) =>
              names.includes(
                item.nutrientName
              )
            );

          return nutrient?.value ?? 0;
        };

        return {
          fdcId: food.fdcId,

          name: food.description,

          brand:
            food.brandOwner ?? null,

          servingSize:
            food.servingSize ?? null,

          servingUnit:
            food.servingSizeUnit ?? null,

          nutrition: {
            calories: getNutrient([
              'Energy',
            ]),

            protein: getNutrient([
              'Protein',
            ]),

            carbs: getNutrient([
              'Carbohydrate, by difference',
              'Carbohydrate, total',
            ]),

            fat: getNutrient([
              'Total lipid (fat)',
            ]),

            fiber: getNutrient([
              'Fiber, total dietary',
            ]),
          },
        };
      }
    );

    return new Response(
      JSON.stringify({
        foods,
        totalHits:
          data.totalHits ?? 0,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      'search-food error:',
      error
    );

    return new Response(
      JSON.stringify({
        error: 'Unexpected server error',
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      }
    );
  }
});
