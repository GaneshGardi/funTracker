const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

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

    const {
      quantity_g,
      nutrition_per_100g,
    } = body;

    // Validate quantity
    if (
      typeof quantity_g !== 'number' ||
      !Number.isFinite(quantity_g) ||
      quantity_g <= 0
    ) {
      return new Response(
        JSON.stringify({
          error:
            'quantity_g must be a positive number',
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

    // Validate nutrition object
    if (
      !nutrition_per_100g ||
      typeof nutrition_per_100g !== 'object'
    ) {
      return new Response(
        JSON.stringify({
          error:
            'nutrition_per_100g is required',
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

    const {
      calories,
      protein,
      carbs,
      fat,
      fiber,
    } = nutrition_per_100g;

    // Calculate multiplier.
    //
    // Example:
    // 150 g / 100 g = 1.5
    //
    const multiplier = quantity_g / 100;

    const calculate = (
      value: unknown
    ): number | null => {
      if (
        typeof value !== 'number' ||
        !Number.isFinite(value)
      ) {
        return null;
      }

      return Number(
        (value * multiplier).toFixed(2)
      );
    };

    const calculatedNutrition = {
      calories: calculate(calories),
      protein: calculate(protein),
      carbs: calculate(carbs),
      fat: calculate(fat),
      fiber: calculate(fiber),
    };

    return new Response(
      JSON.stringify({
        quantity_g,
        basis: 'calculated_from_per_100g',
        nutrition_per_100g: {
          calories,
          protein,
          carbs,
          fat,
          fiber,
        },
        nutrition: calculatedNutrition,
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error(
      'calculate-food error:',
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
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
