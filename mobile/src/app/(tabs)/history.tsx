import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { getCurrentUser, isProfileComplete } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

type FoodLog = {
  id: string;
  food_name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  log_date: string;
};

type DaySummary = {
  date: string;
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

const getDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const formatDayLabel = (date: Date) => {
  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
};

const getBarHeight = (calories: number, maxCalories: number) => {
  if (maxCalories <= 0 || calories <= 0) {
    return 4;
  }

  return Math.max(4, (calories / maxCalories) * 180);
};

export default function HistoryScreen() {
  const [days, setDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dailyGoal, setDailyGoal] = useState<number | null>(null);
  const [showDailyCalories, setShowDailyCalories] = useState(false);

  const loadHistory = async () => {
    setLoading(true);

    try {
      const user = await getCurrentUser();

      if (!user) {
        return;
      }

      const profileComplete = await isProfileComplete(user.id);

      if (!profileComplete) {
        return;
      }

      const today = new Date();

      const dates: Date[] = [];

      for (let i = 6; i >= 0; i -= 1) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        dates.push(date);
      }

      const startDate = getDateString(dates[0]);
      const endDate = getDateString(dates[dates.length - 1]);

      const { data: foodLogs, error: foodError } = await supabase
        .from("food_logs")
        .select(
          "id, food_name, quantity, unit, calories, protein, carbs, fat, fiber, log_date",
        )
        .eq("user_id", user.id)
        .gte("log_date", startDate)
        .lte("log_date", endDate)
        .order("log_date", { ascending: true });

      if (foodError) {
        console.error("Failed to load history:", foodError);
        return;
      }

      const { data: goalData, error: goalError } = await supabase
        .from("calorie_goals")
        .select("daily_calories")
        .eq("user_id", user.id)
        .order("effective_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (goalError) {
        console.error("Failed to load calorie goal:", goalError);
      }

      setDailyGoal(goalData?.daily_calories ?? null);

      const logs = (foodLogs ?? []) as FoodLog[];

      const summaries = dates.map((date) => {
        const dateString = getDateString(date);

        const dayLogs = logs.filter((food) => food.log_date === dateString);

        return {
          date: dateString,
          label: formatDayLabel(date),
          calories: dayLogs.reduce(
            (sum, food) => sum + Number(food.calories || 0),
            0,
          ),
          protein: dayLogs.reduce(
            (sum, food) => sum + Number(food.protein || 0),
            0,
          ),
          carbs: dayLogs.reduce(
            (sum, food) => sum + Number(food.carbs || 0),
            0,
          ),
          fat: dayLogs.reduce((sum, food) => sum + Number(food.fat || 0), 0),
          fiber: dayLogs.reduce(
            (sum, food) => sum + Number(food.fiber || 0),
            0,
          ),
        };
      });

      setDays(summaries);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  const maxCalories = Math.max(
    dailyGoal ?? 0,
    ...days.map((day) => day.calories),
    1,
  );

  const totalCalories = days.reduce((sum, day) => sum + day.calories, 0);

  const averageCalories = days.length > 0 ? totalCalories / days.length : 0;

  const averageProtein =
    days.length > 0
      ? days.reduce((sum, day) => sum + day.protein, 0) / days.length
      : 0;

  const daysWithinGoal =
    dailyGoal !== null
      ? days.filter((day) => day.calories <= dailyGoal).length
      : 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" />

        <Text style={styles.loadingText}>Loading history...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>History</Text>

      <Text style={styles.subtitle}>Your last 7 days</Text>

      {dailyGoal !== null && (
        <View style={styles.goalCard}>
          <Text style={styles.goalLabel}>Daily calorie goal</Text>

          <Text style={styles.goalValue}>{Math.round(dailyGoal)} kcal</Text>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Last 7 days</Text>

        <View style={styles.chartCard}>
          <View style={styles.chart}>
            {days.map((day) => {
              const barHeight = getBarHeight(day.calories, maxCalories);

              const goalHeight =
                dailyGoal !== null ? (dailyGoal / maxCalories) * 180 : null;

              return (
                <View key={day.date} style={styles.barColumn}>
                  <Text style={styles.barValue}>
                    {Math.round(day.calories)}
                  </Text>

                  <View style={styles.barArea}>
                    {goalHeight !== null && (
                      <View
                        style={[
                          styles.goalLine,
                          {
                            bottom: goalHeight,
                          },
                        ]}
                      />
                    )}

                    <View
                      style={[
                        styles.bar,
                        {
                          height: barHeight,
                        },
                      ]}
                    />
                  </View>

                  <Text style={styles.barLabel}>{day.label}</Text>
                </View>
              );
            })}
          </View>

          {dailyGoal !== null && (
            <View style={styles.legend}>
              <View style={styles.legendLine} />

              <Text style={styles.legendText}>
                Daily goal: {Math.round(dailyGoal)} kcal
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Weekly summary</Text>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Average calories</Text>

            <Text style={styles.summaryValue}>
              {Math.round(averageCalories)}
            </Text>

            <Text style={styles.summaryUnit}>kcal/day</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Average protein</Text>

            <Text style={styles.summaryValue}>
              {Math.round(averageProtein)}
            </Text>

            <Text style={styles.summaryUnit}>g/day</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Days within goal</Text>

            <Text style={styles.summaryValue}>{daysWithinGoal}</Text>

            <Text style={styles.summaryUnit}>of {days.length} days</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Total calories</Text>

            <Text style={styles.summaryValue}>{Math.round(totalCalories)}</Text>

            <Text style={styles.summaryUnit}>kcal</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.dailyCaloriesHeader}>
          <Text style={styles.sectionTitle}>Daily calories</Text>

          <Text
            style={styles.expandButton}
            onPress={() => setShowDailyCalories((current) => !current)}
          >
            {showDailyCalories ? "Hide" : "Show"}
          </Text>
        </View>

        {showDailyCalories &&
          [...days].reverse().map((day) => (
            <View
              key={day.date}
              style={[
                styles.dayCard,
                day.date === getDateString(new Date()) && styles.todayCard,
              ]}
            >
              <View>
                <Text style={styles.dayLabel}>{day.label}</Text>

                <Text style={styles.dateLabel}>{day.date}</Text>
              </View>

              <Text style={styles.calorieValue}>
                {Math.round(day.calories)} kcal
              </Text>
            </View>
          ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  content: {
    padding: 20,
    paddingBottom: 40,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },

  loadingText: {
    marginTop: 10,
    color: "#666",
  },

  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },

  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: "#666",
  },

  goalCard: {
    marginTop: 20,
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#f3f3f3",
  },

  goalLabel: {
    fontSize: 13,
    color: "#666",
  },

  goalValue: {
    marginTop: 4,
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },

  section: {
    marginTop: 24,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: "700",
    color: "#111",
    marginBottom: 12,
  },

  chartCard: {
    padding: 16,
    borderRadius: 14,
    backgroundColor: "#f7f7f7",
  },

  chart: {
    height: 230,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },

  barColumn: {
    flex: 1,
    height: "100%",
    alignItems: "center",
    justifyContent: "flex-end",
  },

  barValue: {
    marginBottom: 6,
    fontSize: 10,
    color: "#666",
  },

  barArea: {
    width: 28,
    height: 180,
    justifyContent: "flex-end",
    position: "relative",
  },

  bar: {
    width: "100%",
    borderRadius: 7,
    backgroundColor: "#222",
  },

  goalLine: {
    position: "absolute",
    left: -8,
    right: -8,
    height: 2,
    backgroundColor: "#999",
  },

  barLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    color: "#555",
  },

  legend: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  legendLine: {
    width: 18,
    height: 2,
    backgroundColor: "#999",
    marginRight: 8,
  },

  legendText: {
    fontSize: 12,
    color: "#666",
  },

  summaryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  summaryCard: {
    width: "48%",
    minHeight: 110,
    marginBottom: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#f7f7f7",
    justifyContent: "center",
  },

  summaryLabel: {
    fontSize: 13,
    color: "#666",
  },

  summaryValue: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
  },

  summaryUnit: {
    marginTop: 2,
    fontSize: 12,
    color: "#777",
  },

  dayCard: {
    minHeight: 68,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f7f7f7",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  todayCard: {
    borderWidth: 2,
    borderColor: "#111",
  },

  dayLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },

  dateLabel: {
    marginTop: 3,
    fontSize: 12,
    color: "#777",
  },

  calorieValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111",
  },
  dailyCaloriesHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  expandButton: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
    marginBottom: 12,
  },
});
