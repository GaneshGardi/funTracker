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

    // Get the user's JWT.
    const authHeader =
      req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({
          error: 'Authorization required',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    const body = await req.json();

    const foodId = body?.food_id;
    const quantityG = body?.quantity_g;

    // Validate food ID
    if (
      typeof foodId !== 'string' ||
      !foodId.trim()
    ) {
      return new Response(
        JSON.stringify({
          error: 'food_id is required',
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

    // Validate quantity
    if (
      typeof quantityG !== 'number' ||
      !Number.isFinite(quantityG) ||
      quantityG <= 0
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

    // Supabase environment variables
    const supabaseUrl =
      Deno.env.get('SUPABASE_URL');

    const supabaseAnonKey =
      Deno.env.get(
        'SUPABASE_ANON_KEY'
      );

    if (!supabaseUrl || !supabaseAnonKey) {
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

    // Create a Supabase client using the
    // user's JWT.
    const { createClient } =
      await import(
        'npm:@supabase/supabase-js@2'
      );

    const supabase = createClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        global: {
          headers: {
            Authorization: authHeader,
          },
        },
      }
    );

    // Verify the authenticated user.
    const {
      data: {
        user,
      },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error(
        'Authentication failed:',
        userError
      );

      return new Response(
        JSON.stringify({
          error: 'Invalid authentication',
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    // Get the trusted food reference.
    const {
      data: food,
      error: foodError,
    } = await supabase
      .from('foods')
      .select(
        `
        id,
        name,
        calories,
        protein,
        carbs,
        fat,
        fiber,
        source
        `
      )
      .eq('id', foodId)
      .eq('is_active', true)
      .single();

    if (foodError || !food) {
      console.error(
        'Food lookup failed:',
        foodError
      );

      return new Response(
        JSON.stringify({
          error: 'Food not found',
        }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type':
              'application/json',
          },
        }
      );
    }

    // FunTracker nutrition standard:
    //
    // All values in foods are PER 100 G.
    //
    // serving_size and serving_unit are not
    // used for this calculation.

    const multiplier =
      quantityG / 100;

    const calculate = (
      value: number
    ): number => {
      return Number(
        (Number(value) * multiplier).toFixed(2)
      );
    };

    const nutrition = {
      calories: calculate(
        food.calories
      ),
      protein: calculate(
        food.protein
      ),
      carbs: calculate(
        food.carbs
      ),
      fat: calculate(
        food.fat
      ),
      fiber: calculate(
        food.fiber
      ),
    };

    // Use the user's local calendar date.
    //
    // The client can optionally provide log_date.
    // If not provided, we use the server date.
    const logDate =
      typeof body?.log_date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        body.log_date
      )
        ? body.log_date
        : new Date()
            .toISOString()
            .slice(0, 10);

    // Insert the calculated snapshot.
    //
    // RLS enforces:
    // auth.uid() = user_id
    const {
      data: foodLog,
      error: insertError,
    } = await supabase
      .from('food_logs')
      .insert({
        user_id: user.id,
        food_id: food.id,
        food_name: food.name,
        quantity: quantityG,
        unit: 'g',
        calories: nutrition.calories,
        protein: nutrition.protein,
        carbs: nutrition.carbs,
        fat: nutrition.fat,
        fiber: nutrition.fiber,
        log_date: logDate,
        source: 'manual',
      })
      .select()
      .single();

    if (insertError) {
      console.error(
        'Failed to create food log:',
        insertError
      );

      return new Response(
        JSON.stringify({
          error:
            'Failed to save food log',
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
        success: true,
        foodLog,
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
      'log-food error:',
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
