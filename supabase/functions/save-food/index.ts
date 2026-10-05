const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

const USDA_API_URL =
  'https://api.nal.usda.gov/fdc/v1/food';

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
    });
  }

  try {
    // Only POST is supported
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

    const fdcId = body?.fdcId;

    // Validate FDC ID
    if (
      typeof fdcId !== 'number' &&
      typeof fdcId !== 'string'
    ) {
      return new Response(
        JSON.stringify({
          error: 'fdcId is required',
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
          error:
            'USDA API key is not configured',
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

    // Get Supabase credentials from the
    // Edge Function environment.
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');

    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'Supabase environment variables are missing'
      );

      return new Response(
        JSON.stringify({
          error:
            'Supabase configuration is missing',
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

    // Fetch the selected food from USDA.
    const url =
      `${USDA_API_URL}/${fdcId}?api_key=${apiKey}`;

    const response = await fetch(url);

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        'USDA API error:',
        response.status,
        errorText
      );

      return new Response(
        JSON.stringify({
          error:
            'Could not retrieve food from USDA',
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

    const food = await response.json();

    const nutrients =
      food.foodNutrients ?? [];

    // Extract nutrient by nutrient name.
    const getNutrient = (
      names: string[]
    ): number | null => {
      const nutrient =
        nutrients.find((item: any) => {
          const name =
            item?.nutrient?.name ??
            item?.nutrientName;

          return names.includes(name);
        });

      const value =
        nutrient?.amount ??
        nutrient?.value;

      if (
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        return null;
      }

      return value;
    };

    const calories = getNutrient([
      'Energy',
    ]);

    const protein = getNutrient([
      'Protein',
    ]);

    const carbs = getNutrient([
      'Carbohydrate, by difference',
      'Carbohydrate, total',
    ]);

    const fat = getNutrient([
      'Total lipid (fat)',
    ]);

    const fiber = getNutrient([
      'Fiber, total dietary',
    ]);

    // Calories are required for a usable food.
    if (calories === null) {
      return new Response(
        JSON.stringify({
          error:
            'USDA food does not contain calorie data',
        }),
        {
          status: 422,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    // IMPORTANT:
    //
    // FunTracker stores nutrition as PER 100 G.
    //
    // We do NOT use servingSize to modify
    // the nutrient values.
    //
    // servingSize is stored only as reference
    // information for the UI.

    const foodName =
      food.description?.trim();

    if (!foodName) {
      return new Response(
        JSON.stringify({
          error:
            'USDA food does not have a valid name',
        }),
        {
          status: 422,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    // Import Supabase JS only inside the function.
    const { createClient } =
      await import(
        'npm:@supabase/supabase-js@2'
      );

    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    // Check whether this USDA food has already
    // been stored.
    //
    // We use the source field to keep the
    // original USDA FDC ID.
    const source =
      `usda:${fdcId}`;

    const {
      data: existingFood,
      error: existingError,
    } = await supabase
      .from('foods')
      .select('*')
      .eq('source', source)
      .maybeSingle();

    if (existingError) {
      console.error(
        'Failed checking existing food:',
        existingError
      );

      return new Response(
        JSON.stringify({
          error:
            'Failed checking existing food',
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

    // If already stored, return it instead
    // of creating a duplicate.
    if (existingFood) {
      return new Response(
        JSON.stringify({
          food: existingFood,
          alreadyExists: true,
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
    }

    // Insert the normalized USDA food.
    const { data: savedFood, error } =
      await supabase
        .from('foods')
        .insert({
          name: foodName,

          // Display/reference information only.
          serving_size:
            food.servingSize ?? 100,

          serving_unit:
            food.servingSizeUnit ?? 'g',

          // FunTracker standard:
          // ALL nutrition values are per 100 g.
          calories,
          protein: protein ?? 0,
          carbs: carbs ?? 0,
          fat: fat ?? 0,
          fiber: fiber ?? 0,

          source,

          is_active: true,
        })
        .select()
        .single();

    if (error) {
      console.error(
        'Failed saving food:',
        error
      );

      return new Response(
        JSON.stringify({
          error:
            'Failed saving food to database',
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

    return new Response(
      JSON.stringify({
        food: savedFood,
        alreadyExists: false,
      }),
      {
        status: 201,
        headers: {
          ...corsHeaders,
          'Content-Type':
            'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      'save-food error:',
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
