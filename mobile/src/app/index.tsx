import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import {
  getCurrentUser,
  isProfileComplete,
} from '../lib/auth';

import { supabase } from '../lib/supabase';

type DashboardNutrition = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export default function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [dailyCalories, setDailyCalories] =
    useState<number | null>(null);

  const [nutrition, setNutrition] =
    useState<DashboardNutrition>({
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
    });

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const loadDashboard = async () => {
    setLoading(true);

    const user = await getCurrentUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const complete = await isProfileComplete(user.id);

    if (!complete) {
      setLoading(false);
      router.replace('/onboarding');
      return;
    }

    // Load latest calorie goal
    const { data: goalData, error: goalError } =
      await supabase
        .from('calorie_goals')
        .select('daily_calories')
        .eq('user_id', user.id)
        .order('effective_at', {
          ascending: false,
        })
        .limit(1)
        .maybeSingle();

    if (goalError) {
      console.error(
        'Failed to load calorie goal:',
        goalError
      );
    } else if (goalData) {
      setDailyCalories(
        Number(goalData.daily_calories)
      );
    }

    // Get today's date in local time
    const now = new Date();

    const year = now.getFullYear();
    const month = String(
      now.getMonth() + 1
    ).padStart(2, '0');
    const day = String(
      now.getDate()
    ).padStart(2, '0');

    const today = `${year}-${month}-${day}`;

    // Load today's food logs
    const { data: foodLogs, error: foodLogsError } =
      await supabase
        .from('food_logs')
        .select(
          'calories, protein, carbs, fat, fiber'
        )
        .eq('user_id', user.id)
        .eq('log_date', today);

    if (foodLogsError) {
      console.error(
        'Failed to load food logs:',
        foodLogsError
      );

      setNutrition({
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
      });
    } else {
      const totals = (foodLogs ?? []).reduce(
        (sum, food) => ({
          calories:
            sum.calories +
            Number(food.calories ?? 0),

          protein:
            sum.protein +
            Number(food.protein ?? 0),

          carbs:
            sum.carbs +
            Number(food.carbs ?? 0),

          fat:
            sum.fat +
            Number(food.fat ?? 0),

          fiber:
            sum.fiber +
            Number(food.fiber ?? 0),
        }),
        {
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        }
      );

      setNutrition(totals);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const caloriesConsumed = Math.round(
    nutrition.calories
  );

  const caloriesRemaining =
    dailyCalories !== null
      ? Math.max(
          dailyCalories - caloriesConsumed,
          0
        )
      : 0;

  const progress =
    dailyCalories && dailyCalories > 0
      ? Math.min(
          caloriesConsumed / dailyCalories,
          1
        )
      : 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              Today's nutrition
            </Text>

            <Text style={styles.title}>
              FunTracker
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() => {}}
          >
            <Text style={styles.profileButtonText}>
              👤
            </Text>
          </Pressable>
        </View>

        {/* Calorie Card */}
        <View style={styles.calorieCard}>
          <Text style={styles.cardLabel}>
            Calories
          </Text>

          <View style={styles.calorieNumbers}>
            <View>
              <Text style={styles.consumedCalories}>
                {caloriesConsumed}
              </Text>

              <Text style={styles.smallLabel}>
                consumed
              </Text>
            </View>

            <Text style={styles.divider}>
              /
            </Text>

            <View>
              <Text style={styles.goalCalories}>
                {dailyCalories ?? '--'}
              </Text>

              <Text style={styles.smallLabel}>
                goal
              </Text>
            </View>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBackground}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                },
              ]}
            />
          </View>

          <Text style={styles.remainingText}>
            {caloriesRemaining} kcal remaining
          </Text>
        </View>

        {/* Macros */}
        <Text style={styles.sectionTitle}>
          Today's macros
        </Text>

        <View style={styles.macroGrid}>
          <MacroCard
            label="Protein"
            value={nutrition.protein}
            unit="g"
          />

          <MacroCard
            label="Carbs"
            value={nutrition.carbs}
            unit="g"
          />

          <MacroCard
            label="Fat"
            value={nutrition.fat}
            unit="g"
          />

          <MacroCard
            label="Fiber"
            value={nutrition.fiber}
            unit="g"
          />
        </View>

        {/* Add Food */}
        <Pressable
          style={styles.addFoodButton}
          onPress={() =>
            router.push('/add-food')
          }
        >
          <Text style={styles.addFoodIcon}>
            +
          </Text>

          <View>
            <Text style={styles.addFoodTitle}>
              Add food
            </Text>

            <Text style={styles.addFoodSubtitle}>
              Log what you eat today
            </Text>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

type MacroCardProps = {
  label: string;
  value: number;
  unit: string;
};

function MacroCard({
  label,
  value,
  unit,
}: MacroCardProps) {
  return (
    <View style={styles.macroCard}>
      <Text style={styles.macroLabel}>
        {label}
      </Text>

      <Text style={styles.macroValue}>
        {Number(value).toFixed(1)}
        <Text style={styles.macroUnit}>
          {' '}
          {unit}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },

  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },

  container: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },

  greeting: {
    fontSize: 14,
    color: '#777',
  },

  title: {
    marginTop: 4,
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },

  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },

  profileButtonText: {
    fontSize: 20,
  },

  calorieCard: {
    padding: 24,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },

  cardLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },

  calorieNumbers: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },

  consumedCalories: {
    fontSize: 42,
    fontWeight: '700',
    color: '#111',
  },

  goalCalories: {
    fontSize: 28,
    fontWeight: '600',
    color: '#555',
  },

  divider: {
    marginHorizontal: 12,
    fontSize: 28,
    color: '#aaa',
  },

  smallLabel: {
    marginTop: 2,
    fontSize: 13,
    color: '#888',
  },

  progressBackground: {
    height: 10,
    marginTop: 24,
    borderRadius: 5,
    backgroundColor: '#ddd',
    overflow: 'hidden',
  },

  progressFill: {
    height: '100%',
    borderRadius: 5,
    backgroundColor: '#111',
  },

  remainingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },

  sectionTitle: {
    marginTop: 32,
    marginBottom: 14,
    fontSize: 19,
    fontWeight: '700',
    color: '#111',
  },

  macroGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  macroCard: {
    width: '48%',
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
  },

  macroLabel: {
    fontSize: 14,
    color: '#777',
  },

  macroValue: {
    marginTop: 8,
    fontSize: 25,
    fontWeight: '700',
    color: '#111',
  },

  macroUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#777',
  },

  addFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    padding: 18,
    borderRadius: 16,
    backgroundColor: '#111',
  },

  addFoodIcon: {
    width: 40,
    height: 40,
    marginRight: 14,
    borderRadius: 20,
    backgroundColor: '#fff',
    textAlign: 'center',
    lineHeight: 38,
    fontSize: 28,
    color: '#111',
  },

  addFoodTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },

  addFoodSubtitle: {
    marginTop: 3,
    fontSize: 13,
    color: '#ccc',
  },
});
