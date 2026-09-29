import { supabase } from './supabase';

export const testSupabaseConnection = async () => {
  const { data, error } = await supabase
    .from('foods')
    .select('id')
    .limit(1);

  if (error) {
    console.error('Supabase connection failed:', error);
    return false;
  }

  console.log('Supabase connection successful:', data);
  return true;
};