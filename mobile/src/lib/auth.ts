import { supabase } from './supabase';

export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('Failed to get current user:', error);
    return null;
  }

  return user;
}

export async function isProfileComplete(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'birth_date, gender, height_cm, weight_kg, goal'
    )
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Failed to get profile:', error);
    return false;
  }

  return Boolean(
    data.birth_date &&
    data.gender &&
    data.height_cm &&
    data.weight_kg &&
    data.goal
  );
}