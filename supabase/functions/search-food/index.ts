const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods':
    'POST, OPTIONS',
};

const USDA_API_URL =
  'https://api.nal.usda.gov/fdc/v1/foods/search';

type RankedFood = {
  food: any;
  score: number;
  normalizedName: string;
};

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

    const normalizeText = (
      value: string
    ) => {
      return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const normalizedQuery =
      normalizeText(query);

    const queryTokens =
      normalizedQuery
        .split(' ')
        .filter(Boolean);

    const url = new URL(USDA_API_URL);

    url.searchParams.set(
      'api_key',
      apiKey
    );

    url.searchParams.set(
      'query',
      query
    );

    /*
     * Ask USDA for a larger candidate pool.
     * We do our own relevance ranking afterwards.
     */
    url.searchParams.set(
      'pageSize',
      '100'
    );

    const response = await fetch(
      url.toString()
    );

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

    /*
     * Words that usually indicate the result
     * is NOT the basic ingredient the user searched for.
     */
    const productWords = [
  'brand',
  'crackers',
  'cracker',
  'chips',
  'chip',
  'flour',
  'paper',
  'cereal',
  'bar',
  'cookie',
  'cake',
  'bread',
  'biscuit',
  'snack',
  'powder',
  'starch',
  'drink',
  'beverage',
  'sauce',
  'dressing',
  'spread',
  'dip',
  'milk',
  'croquette',
  'pudding',
  'candy',
  'cooked with',

  // Compound foods/products
  'noodles',
  'noodle',
  'puffs',
  'puff',
  'flakes',
  'cereal',
  'bran',
  'crust',
  'cracker',
  'wafer',
  'sticks',
  'rings',
  'balls',
  'cereal',
  'mix',
  'mixture',
  'stuffing',
  'filling',
];

    const preparedDishWords = [
      'fried',
      'roll',
      'sandwich',
      'burger',
      'nugget',
      'patty',
      'pizza',
      'lasagna',
      'casserole',
      'salad',
      'soup',
      'stew',
      'curry',
      'biryani',
      'pilaf',
      'risotto',
      'pudding',
      'pie',
      'taco',
      'burrito',
      'wrap',
      'entree',
      'meal',
      'dish',
      'with sauce',
      'with gravy',
      'stuffed',
    ];

    const imitationWords = [
      'meatless',
      'imitation',
      'artificial',
      'mock',
      'vegetarian',
      'vegan',
      'plant based',
      'plant-based',
    ];

    const preferredPreparationWords = [
      'raw',
      'cooked',
      'boiled',
      'baked',
      'roasted',
      'steamed',
      'grilled',
    ];

    const basicFoodIndicators = [
      'whole',
      'breast',
      'thigh',
      'leg',
      'drumstick',
      'wing',
      'fillet',
      'loin',
      'ground',
      'meat',
      'potato',
      'rice',
      'oat',
      'oats',
      'egg',
      'milk',
      'yogurt',
      'curd',
      'cheese',
      'paneer',
      'beans',
      'lentils',
      'dal',
      'banana',
      'apple',
      'orange',
      'tomato',
      'spinach',
      'broccoli',
      'carrot',
      'onion',
    ];

    const dataTypeScore: Record<
      string,
      number
    > = {
      Foundation: 35,
      'SR Legacy': 30,
      Survey: 10,
      Branded: -35,
    };

    function containsPhrase(
      name: string,
      phrase: string
    ) {
      return name.includes(
        normalizeText(phrase)
      );
    }

    function scoreFood(
      food: any
    ): number {
      const name =
        normalizeText(
          food.description ?? ''
        );

      let score = 0;

      /*
       * ------------------------------------------------
       * 1. QUERY MATCH
       * ------------------------------------------------
       */

      if (name === normalizedQuery) {
        score += 200;
      } else if (
        name.startsWith(
          normalizedQuery + ' '
        )
      ) {
        score += 110;
      } else if (
        name.includes(normalizedQuery)
      ) {
        score += 70;
      }

      /*
       * Reward individual query words.
       */
      for (const token of queryTokens) {
        if (name.includes(token)) {
          score += 15;
        }
      }

      /*
       * ------------------------------------------------
       * 2. BASIC FOOD vs PRODUCT
       * ------------------------------------------------
       */

      for (const word of productWords) {
        if (
          containsPhrase(name, word) &&
          !containsPhrase(
            normalizedQuery,
            word
          )
        ) {
          score -= 90;
        }
      }

      /*
       * ------------------------------------------------
       * 3. PREPARED DISH PENALTY
       * ------------------------------------------------
       */

      for (const word of preparedDishWords) {
        if (
          containsPhrase(name, word) &&
          !containsPhrase(
            normalizedQuery,
            word
          )
        ) {
          score -= 60;
        }
      }

      /*
       * ------------------------------------------------
       * 4. IMITATION / MEATLESS PENALTY
       * ------------------------------------------------
       */

      for (const word of imitationWords) {
        if (
          containsPhrase(name, word) &&
          !containsPhrase(
            normalizedQuery,
            word
          )
        ) {
          score -= 80;
        }
      }

      /*
       * ------------------------------------------------
       * 5. PREFER SIMPLE BASIC FOODS
       * ------------------------------------------------
       */

      const nameTokens =
        name.split(' ');

      if (
        nameTokens.length <= 3
      ) {
        score += 25;
      } else if (
        nameTokens.length <= 6
      ) {
        score += 10;
      } else if (
        nameTokens.length >= 10
      ) {
        score -= 20;
      }

      /*
       * Reward basic-food terminology.
       */
      for (
        const indicator
        of basicFoodIndicators
      ) {
        if (
          containsPhrase(
            name,
            indicator
          )
        ) {
          score += 5;
        }
      }

      /*
       * ------------------------------------------------
       * 6. NORMAL COOKING STATES
       * ------------------------------------------------
       *
       * Raw/cooked/boiled/baked/etc. are useful
       * because they represent actual food states.
       */
      for (
        const preparation
        of preferredPreparationWords
      ) {
        if (
          containsPhrase(
            name,
            preparation
          )
        ) {
          score += 8;
        }
      }

      /*
       * ------------------------------------------------
       * 7. USDA DATA TYPE
       * ------------------------------------------------
       */

      score +=
        dataTypeScore[
          food.dataType ?? ''
        ] ?? 0;

      /*
       * ------------------------------------------------
       * 8. NUTRITION COMPLETENESS
       * ------------------------------------------------
       */

      const nutrients =
        food.foodNutrients ?? [];

      const hasNutrient = (
        names: string[]
      ) =>
        nutrients.some(
          (item: any) =>
            names.includes(
              item.nutrientName
            )
        );

      if (
        hasNutrient([
          'Energy',
        ])
      ) {
        score += 10;
      }

      if (
        hasNutrient([
          'Protein',
        ])
      ) {
        score += 5;
      }

      if (
        hasNutrient([
          'Carbohydrate, by difference',
          'Carbohydrate, total',
        ])
      ) {
        score += 5;
      }

      if (
        hasNutrient([
          'Total lipid (fat)',
        ])
      ) {
        score += 3;
      }

      /*
       * ------------------------------------------------
       * 9. BRAND PENALTY
       * ------------------------------------------------
       */

      if (
        food.dataType ===
        'Branded'
      ) {
        score -= 30;
      }

      if (
        food.brandOwner
      ) {
        score -= 15;
      }

      return score;
    }

    /*
     * ------------------------------------------------
     * RANK ALL USDA RESULTS
     * ------------------------------------------------
     */

    const ranked: RankedFood[] =
      (data.foods ?? []).map(
        (food: any) => ({
          food,
          score: scoreFood(food),
          normalizedName:
            normalizeText(
              food.description ?? ''
            ),
        })
      );

    ranked.sort(
      (a, b) =>
        b.score - a.score
    );

    /*
     * ------------------------------------------------
     * REMOVE EXACT DUPLICATE NAMES
     * ------------------------------------------------
     */

    const seenNames =
      new Set<string>();

    const selected =
      ranked.filter(
        (item) => {
          if (
            seenNames.has(
              item.normalizedName
            )
          ) {
            return false;
          }

          seenNames.add(
            item.normalizedName
          );

          return true;
        }
      );

    /*
     * ------------------------------------------------
     * NUTRIENT EXTRACTION
     * ------------------------------------------------
     */

    const getNutrient = (
      nutrients: any[],
      names: string[]
    ) => {
      const nutrient =
        nutrients.find(
          (item: any) =>
            names.includes(
              item.nutrientName
            )
        );

      return (
        nutrient?.value ?? null
      );
    };

    /*
     * ------------------------------------------------
     * FINAL RESPONSE
     * ------------------------------------------------
     */

    const foods = selected
      .slice(0, 10)
      .map(
        ({ food }) => {
          const nutrients =
            food.foodNutrients ?? [];

          return {
            fdcId:
              food.fdcId,

            name:
              food.description,

            brand:
              food.brandOwner ??
              null,

            dataType:
              food.dataType ??
              null,

            servingSize:
              food.servingSize ??
              null,

            servingUnit:
              food.servingSizeUnit ??
              null,

            nutrition: {
              basis:
                'per_100g',

              calories:
                getNutrient(
                  nutrients,
                  [
                    'Energy',
                  ]
                ),

              protein:
                getNutrient(
                  nutrients,
                  [
                    'Protein',
                  ]
                ),

              carbs:
                getNutrient(
                  nutrients,
                  [
                    'Carbohydrate, by difference',
                    'Carbohydrate, total',
                  ]
                ),

              fat:
                getNutrient(
                  nutrients,
                  [
                    'Total lipid (fat)',
                  ]
                ),

              fiber:
                getNutrient(
                  nutrients,
                  [
                    'Fiber, total dietary',
                  ]
                ),
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
        error:
          'Unexpected server error',
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