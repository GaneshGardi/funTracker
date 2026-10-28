import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const responseSchema = {
  type: 'OBJECT',
  properties: {
    meal_name: { type: 'STRING' },
    notes: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING' },
          quantity_g: { type: 'NUMBER' },
          calories: { type: 'NUMBER' },
          protein: { type: 'NUMBER' },
          carbs: { type: 'NUMBER' },
          fat: { type: 'NUMBER' },
          fiber: { type: 'NUMBER' },
        },
        required: [
          'name',
          'quantity_g',
          'calories',
          'protein',
          'carbs',
          'fat',
          'fiber',
        ],
      },
    },
  },
  required: ['meal_name', 'notes', 'items'],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  try {
    if (req.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return jsonResponse({ error: 'Authorization required' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !geminiApiKey) {
      console.error('Required environment configuration is missing.');
      return jsonResponse({ error: 'Server configuration is missing' }, 500);
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } =
      await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: 'Invalid or expired session' }, 401);
    }

    const body = await req.json();
    const imageBase64 = body?.image_base64;
    const mimeType = body?.mime_type;

    if (
      typeof imageBase64 !== 'string' ||
      imageBase64.length < 100 ||
      imageBase64.length > 12_000_000
    ) {
      return jsonResponse({ error: 'Image is missing or too large' }, 400);
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return jsonResponse({
        error: 'Image must be JPEG, PNG, or WebP',
      }, 400);
    }

    const prompt = `
You are a careful food-nutrition estimation assistant for a calorie tracker.

Inspect the supplied meal photo. Identify each visibly distinct food and estimate
the edible amount in grams and its nutrition for that amount.

Return estimates, not claims of exact measurement. Use visual portion size and
typical preparation. Include visible oil, sauces, and cooking fats when reasonably
inferable. Do not invent ingredients that cannot reasonably be inferred.
For mixed dishes, estimate the dish as one item unless separate components are
clearly distinguishable. Do not use external food databases.

For every item, provide:
- name: concise, editable food name
- quantity_g: estimated edible portion in grams
- calories: kcal for that portion
- protein, carbs, fat, fiber: grams for that portion

All nutrition values must refer to the item's estimated quantity, NOT per 100 g.
Use non-negative numbers. If the photo does not show food clearly, return an empty
items array and explain the issue in notes. Do not include markdown or extra keys.
`;

    const geminiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: imageBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema,
            temperature: 0.2,
          },
        }),
      },
    );

    if (!geminiResponse.ok) {
      const providerError = await geminiResponse.text();
      console.error('Gemini request failed:', providerError.slice(0, 1000));
      return jsonResponse({ error: 'AI analysis failed. Please try again.' }, 502);
    }

    const providerData = await geminiResponse.json();
    const text = providerData?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? '')
      .join('');

    if (typeof text !== 'string' || !text.trim()) {
      return jsonResponse({ error: 'AI returned an empty response' }, 502);
    }

    const result = JSON.parse(text);

    if (
      !result ||
      typeof result.meal_name !== 'string' ||
      typeof result.notes !== 'string' ||
      !Array.isArray(result.items) ||
      result.items.length > 20
    ) {
      return jsonResponse({ error: 'AI returned an invalid nutrition result' }, 502);
    }

    for (const item of result.items) {
      const numericFields = [
        'quantity_g', 'calories', 'protein', 'carbs', 'fat', 'fiber',
      ];

      if (
        typeof item.name !== 'string' ||
        !item.name.trim() ||
        item.name.length > 120 ||
        numericFields.some((field) =>
          typeof item[field] !== 'number' ||
          !Number.isFinite(item[field]) ||
          item[field] < 0
        ) ||
        item.quantity_g <= 0 ||
        item.calories > 10000 ||
        item.quantity_g > 10000
      ) {
        return jsonResponse({ error: 'AI returned invalid item values' }, 502);
      }
    }

    return jsonResponse({
      success: true,
      meal: result,
      disclaimer: 'Nutrition values are estimates. Review and edit before saving.',
    });
  } catch (error) {
    console.error('analyze-meal error:', error);
    return jsonResponse({ error: 'Unexpected server error' }, 500);
  }
});
