import { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';

import { supabase } from '@/lib/supabase';
import {
  calculateFood,
  logFood,
  saveFood,
} from '@/lib/food';

type FoodSearchResult = {
  fdcId: number;
  name: string;
  brand: string | null;
  dataType: string | null;
  servingSize: number | null;
  servingUnit: string | null;
  nutrition: {
    basis: string;
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
  };
};

type SelectedFood = {
  id: string;
  name: string;
  source: string | null;
};

type CalculationResult = {
  food: SelectedFood;
  quantity_g: number;
  nutrition: {
    calories: number | null;
    protein: number | null;
    carbs: number | null;
    fat: number | null;
    fiber: number | null;
  };
};

export default function AddFoodScreen() {
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState('');
  const [foods, setFoods] = useState<FoodSearchResult[]>([]);
  const [selectedFood, setSelectedFood] =
    useState<SelectedFood | null>(null);

    useEffect(() => {
  console.log('SELECTED FOOD STATE:', selectedFood);
}, [selectedFood]);

  const [calculation, setCalculation] =
    useState<CalculationResult | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function searchFoods() {
    const query = search.trim();

    if (!query) {
      Alert.alert(
        'Enter a food',
        'Type something like chicken, rice, or oats.'
      );
      return;
    }

    setLoading(true);
    setFoods([]);
    setSelectedFood(null);
    setCalculation(null);

    try {
      const { data, error } =
        await supabase.functions.invoke(
          'search-food',
          {
            body: {
              query,
            },
          }
        );

      if (error) {
        throw new Error(error.message);
      }

      setFoods(data?.foods ?? []);
    } catch (error) {
      console.error(
        'Food search failed:',
        error
      );

      Alert.alert(
        'Search failed',
        'Could not search for food right now.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function calculateSelectedFood() {
    if (!selectedFood) {
      Alert.alert(
        'Select a food',
        'Choose a food from the search results first.'
      );
      return;
    }

    const quantityG = Number(quantity);

    if (
      !Number.isFinite(quantityG) ||
      quantityG <= 0
    ) {
      Alert.alert(
        'Invalid quantity',
        'Enter a quantity greater than 0 grams.'
      );
      return;
    }

    setLoading(true);
    setCalculation(null);

    try {
      const result = await calculateFood(
        selectedFood.id,
        quantityG
      );

      setCalculation(result);
    } catch (error) {
      console.error(
        'Food calculation failed:',
        error
      );

      Alert.alert(
        'Calculation failed',
        'Could not calculate the nutrition.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmAndAdd() {
    if (!selectedFood || !calculation) {
      return;
    }

    setSaving(true);

    try {
      const today = new Date()
        .toISOString()
        .slice(0, 10);

      await logFood(
        selectedFood.id,
        calculation.quantity_g,
        today
      );

      Alert.alert(
        'Food added',
        `${selectedFood.name} has been added to today's log.`,
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      console.error(
        'Food logging failed:',
        error
      );

      Alert.alert(
        'Could not save',
        'The food could not be added.'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>
        Add Food
      </Text>

      <Text style={styles.subtitle}>
        Search for a food and enter the amount in grams.
      </Text>

      <View style={styles.searchRow}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="e.g. chicken breast"
          style={styles.input}
          onSubmitEditing={searchFoods}
          returnKeyType="search"
        />

        <Pressable
          style={[
            styles.searchButton,
            loading && styles.disabledButton,
          ]}
          onPress={searchFoods}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? '...' : 'Search'}
          </Text>
        </Pressable>
      </View>

      {foods.length > 0 && (
        <View style={styles.results}>
          <Text style={styles.sectionTitle}>
            Search results
          </Text>

          {foods.map((food) => (
            <Pressable
              key={food.fdcId}
              style={styles.foodItem}
              onPress={async () => {
                try {
                  setLoading(true);
                  setCalculation(null);

                  const savedFood =
  await saveFood(food.fdcId);

setSelectedFood({
  id: savedFood.id,
  name: savedFood.name,
  source: savedFood.source ?? null,
});

setFoods([]);
                } catch (error) {
                  console.error(
                    'Saving food reference failed:',
                    error
                  );

                  Alert.alert(
                    'Could not select food',
                    'This food could not be added to the food database.'
                  );
                } finally {
                  setLoading(false);
                }
              }}
            >
              <Text style={styles.foodName}>
                {food.name}
              </Text>

              {food.brand ? (
                <Text style={styles.source}>
                  {food.brand}
                </Text>
              ) : null}

              {food.dataType ? (
                <Text style={styles.source}>
                  {food.dataType}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      {selectedFood && (
        <View style={styles.selectedSection}>
          <Text style={styles.sectionTitle}>
            Selected food
          </Text>

          <View style={styles.selectedFoodCard}>
            <Text style={styles.selectedName}>
              {selectedFood.name}
            </Text>

            <Text style={styles.selectedHint}>
              Enter the amount you want to eat.
            </Text>
          </View>

          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="Quantity in grams"
            keyboardType="decimal-pad"
            style={styles.quantityInput}
          />

          <Pressable
            style={[
              styles.calculateButton,
              loading && styles.disabledButton,
            ]}
            onPress={calculateSelectedFood}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading
                ? 'Calculating...'
                : 'Calculate Nutrition'}
            </Text>
          </Pressable>
        </View>
      )}

      {calculation && (
        <View style={styles.preview}>
          <Text style={styles.sectionTitle}>
            Nutrition preview
          </Text>

          <Text style={styles.previewFood}>
            {calculation.food.name}
          </Text>

          <Text style={styles.quantityText}>
            {calculation.quantity_g} g
          </Text>

          <View style={styles.macroRow}>
            <Macro
              label="Calories"
              value={calculation.nutrition.calories}
              suffix=" kcal"
            />

            <Macro
              label="Protein"
              value={calculation.nutrition.protein}
              suffix=" g"
            />

            <Macro
              label="Carbs"
              value={calculation.nutrition.carbs}
              suffix=" g"
            />

            <Macro
              label="Fat"
              value={calculation.nutrition.fat}
              suffix=" g"
            />

            <Macro
              label="Fiber"
              value={calculation.nutrition.fiber}
              suffix=" g"
            />
          </View>

          <Text style={styles.confirmText}>
            Check the estimate before adding it.
          </Text>

          <Pressable
            style={[
              styles.confirmButton,
              saving && styles.disabledButton,
            ]}
            onPress={confirmAndAdd}
            disabled={saving}
          >
            <Text style={styles.buttonText}>
              {saving
                ? 'Adding...'
                : 'Confirm & Add'}
            </Text>
          </Pressable>
        </View>
      )}

      <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <Text style={styles.backText}>
          Cancel
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function Macro({
  label,
  value,
  suffix,
}: {
  label: string;
  value: number | null;
  suffix: string;
}) {
  return (
    <View style={styles.macro}>
      <Text style={styles.macroLabel}>
        {label}
      </Text>

      <Text style={styles.macroValue}>
        {value === null
          ? '—'
          : `${value}${suffix}`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    paddingTop: 50,
    paddingBottom: 40,
    gap: 16,
  },

  title: {
    fontSize: 32,
    fontWeight: '700',
  },

  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },

  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },

  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  quantityInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },

  searchButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
    minWidth: 80,
    alignItems: 'center',
  },

  calculateButton: {
    backgroundColor: '#111',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },

  confirmButton: {
    backgroundColor: '#16803c',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },

  disabledButton: {
    opacity: 0.5,
  },

  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },

  results: {
    gap: 8,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
  },

  foodItem: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    backgroundColor: '#fff',
  },

  foodName: {
    fontSize: 16,
    fontWeight: '600',
  },

  source: {
    marginTop: 4,
    fontSize: 12,
    color: '#777',
  },

  selectedSection: {
    gap: 10,
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 14,
    padding: 16,
    backgroundColor: '#fff',
  },

  selectedFoodCard: {
    gap: 4,
  },

  selectedName: {
    fontSize: 21,
    fontWeight: '700',
  },

  selectedHint: {
    fontSize: 13,
    color: '#666',
  },

  preview: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    padding: 16,
    gap: 12,
    backgroundColor: '#fafafa',
  },

  previewFood: {
    fontSize: 18,
    fontWeight: '600',
  },

  quantityText: {
    color: '#666',
  },

  macroRow: {
    gap: 10,
  },

  macro: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  macroLabel: {
    color: '#666',
  },

  macroValue: {
    fontWeight: '700',
  },

  confirmText: {
    fontSize: 13,
    color: '#666',
  },

  backButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },

  backText: {
    fontSize: 15,
    color: '#666',
  },
});