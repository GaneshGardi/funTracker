import { supabase } from './supabase';

export async function calculateFood(
  foodId: string,
  quantityG: number
) {
  const { data, error } =
    await supabase.functions.invoke(
      'calculate-food',
      {
        body: {
          food_id: foodId,
          quantity_g: quantityG,
        },
      }
    );

  if (error) {
    console.error(
      'calculate-food error:',
      error
    );

    throw new Error(
      error.message ||
        'Failed to calculate food nutrition'
    );
  }

  return data;
}

export async function logFood(
  foodId: string,
  quantityG: number,
  logDate: string
) {
  const { data, error } =
    await supabase.functions.invoke(
      'log-food',
      {
        body: {
          food_id: foodId,
          quantity_g: quantityG,
          log_date: logDate,
        },
      }
    );

  if (error) {
    console.error(
      'log-food error:',
      error
    );

    throw new Error(
      error.message ||
        'Failed to save food'
    );
  }

  return data;
}

export async function saveFood(
  fdcId: number
) {
  console.log('saveFood START:', fdcId);

  const { data, error } =
    await supabase.functions.invoke(
      'save-food',
      {
        body: {
          fdcId,
        },
      }
    );

  console.log('saveFood INVOKE DATA:', data);
  console.log('saveFood INVOKE ERROR:', error);

  if (error) {
    console.error(
      'save-food error:',
      error
    );

    throw new Error(
      error.message ||
        'Failed to save food reference'
    );
  }

  if (!data?.food?.id) {
    console.log(
      'saveFood INVALID DATA:',
      data
    );

    throw new Error(
      'Food was saved but no local food ID was returned'
    );
  }

  console.log(
    'saveFood RETURNING FOOD:',
    data.food
  );

  return data.food;
}