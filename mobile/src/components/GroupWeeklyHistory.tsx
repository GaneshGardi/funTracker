
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";

import { supabase } from "../lib/supabase";

type WeeklyHistoryRow = {
  user_id: string;
  username: string;
  display_name: string | null;
  log_date: string;
  calories_consumed: number | string;
  daily_calorie_goal: number | string | null;
};

type GroupWeeklyHistoryProps = {
  groupId: string;
  refreshToken: number;
  memberId: string;
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateLabel = (dateString: string) => {
  // Noon avoids date shifts caused by midnight/timezone conversions.
  const date = new Date(`${dateString}T12:00:00`);

  return {
    weekday: date.toLocaleDateString(undefined, { weekday: "short" }),
    date: date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    }),
    fullDate: date.toLocaleDateString(undefined, {
      weekday: "long",
      day: "numeric",
      month: "long",
    }),
  };
};

const getCalories = (value: number | string | null | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

export default function GroupWeeklyHistory({
  groupId,
  refreshToken,
  memberId,
}: GroupWeeklyHistoryProps) {
  const [history, setHistory] = useState<WeeklyHistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadHistory = useCallback(async () => {
    if (!groupId || !memberId) {
      setHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const today = new Date();
      const endDate = getLocalDateString(today);

      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      const startDate = getLocalDateString(start);

      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";

      const { data, error: fetchError } = await supabase.rpc(
        "get_group_weekly_history",
        {
          p_group_id: groupId,
          p_start_date: startDate,
          p_end_date: endDate,
          p_timezone: timezone,
        },
      );

      if (fetchError) throw fetchError;

      // Keep only the member whose history is currently open.
      const rows = (data ?? []) as WeeklyHistoryRow[];
      setHistory(rows.filter((row) => row.user_id === memberId));
    } catch (err) {
      console.error("Failed to load member weekly history:", err);
      setHistory([]);
      setError(
        "Couldn't load weekly history. Pull down to refresh and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, memberId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory, refreshToken]),
  );

  const selectedDays = history.sort((a, b) =>
    a.log_date.localeCompare(b.log_date),
  );

  const selectedMember = selectedDays[0];

  const totalCalories = selectedDays.reduce(
    (sum, day) => sum + getCalories(day.calories_consumed),
    0,
  );

  const averageCalories =
    selectedDays.length > 0 ? totalCalories / selectedDays.length : 0;

  const chartMaximum = Math.max(
    1,
    ...selectedDays.map((day) =>
      Math.max(
        getCalories(day.calories_consumed),
        getCalories(day.daily_calorie_goal),
      ),
    ),
  );

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.sectionTitle}>Weekly history</Text>
          <Text style={styles.subtitle}>Last 7 days · calories only</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh weekly history"
          style={styles.refreshButton}
          onPress={() => void loadHistory()}
          disabled={loading}
        >
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.statusCard}>
          <ActivityIndicator color="#729580" />
          <Text style={styles.muted}>Loading weekly history...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusCard}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void loadHistory()}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : !selectedMember ? (
        <View style={styles.statusCard}>
          <Text style={styles.muted}>
            No weekly history is available for this member yet.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryName}>
              {selectedMember.display_name?.trim() ||
                selectedMember.username}
            </Text>

            <Text style={styles.summaryUsername}>
              @{selectedMember.username}
            </Text>

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.statLabel}>7-day total</Text>
                <Text style={styles.statValue}>
                  {Math.round(totalCalories).toLocaleString()}
                </Text>
                <Text style={styles.statUnit}>kcal</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.summaryStat}>
                <Text style={styles.statLabel}>Daily average</Text>
                <Text style={styles.statValue}>
                  {Math.round(averageCalories).toLocaleString()}
                </Text>
                <Text style={styles.statUnit}>kcal/day</Text>
              </View>
            </View>
          </View>

          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>Daily calories</Text>

            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={styles.legendBar} />
                <Text style={styles.legendText}>Consumed</Text>
              </View>

              <View style={styles.legendItem}>
                <View style={styles.legendGoalLine} />
                <Text style={styles.legendText}>Daily goal</Text>
              </View>
            </View>

            <View style={styles.chart}>
              {selectedDays.map((day) => {
                const calories = getCalories(day.calories_consumed);
                const goal =
                  day.daily_calorie_goal == null
                    ? null
                    : getCalories(day.daily_calorie_goal);

                const barHeight =
                  calories > 0 ? (calories / chartMaximum) * 100 : 3;

                const goalBottom =
                  goal !== null && goal > 0
                    ? (goal / chartMaximum) * 100
                    : null;

                const labels = getDateLabel(day.log_date);

                return (
                  <View key={day.log_date} style={styles.barColumn}>
                    <Text style={styles.barValue}>
                      {calories >= 1000
                        ? `${(calories / 1000).toFixed(1)}k`
                        : Math.round(calories).toString()}
                    </Text>

                    <View style={styles.barArea}>
                      {goalBottom !== null && (
                        <View
                          style={[
                            styles.goalLine,
                            { bottom: goalBottom },
                          ]}
                        />
                      )}

                      <View
                        style={[
                          styles.bar,
                          { height: Math.max(3, barHeight) },
                        ]}
                      />
                    </View>

                    <Text style={styles.weekdayLabel}>
                      {labels.weekday}
                    </Text>
                    <Text style={styles.dateLabel}>{labels.date}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          <View style={styles.breakdownCard}>
            <Text style={styles.chartTitle}>Daily breakdown</Text>

            {selectedDays
              .slice()
              .reverse()
              .map((day) => {
                const calories = getCalories(day.calories_consumed);
                const goal =
                  day.daily_calorie_goal == null
                    ? null
                    : getCalories(day.daily_calorie_goal);

                const percentage =
                  goal !== null && goal > 0
                    ? Math.round((calories / goal) * 100)
                    : null;

                const labels = getDateLabel(day.log_date);

                return (
                  <View key={day.log_date} style={styles.dayRow}>
                    <View style={styles.dayHeader}>
                      <View style={styles.dayInfo}>
                        <Text style={styles.dayName}>
                          {labels.fullDate}
                        </Text>
                        <Text style={styles.dayGoal}>
                          {goal !== null && goal > 0
                            ? `Goal: ${Math.round(goal).toLocaleString()} kcal`
                            : "Goal not set"}
                        </Text>
                      </View>

                      <View style={styles.dayTotals}>
                        <Text style={styles.dayCalories}>
                          {Math.round(calories).toLocaleString()}
                        </Text>
                        <Text style={styles.dayKcal}>kcal</Text>
                      </View>
                    </View>

                    {goal !== null && goal > 0 && (
                      <>
                        <View style={styles.dayTrack}>
                          <View
                            style={[
                              styles.dayFill,
                              {
                                width: `${Math.min(percentage ?? 0, 100)}%`,
                              },
                            ]}
                          />
                        </View>

                        <Text style={styles.dayPercentage}>
                          {percentage}% of goal
                        </Text>
                      </>
                    )}
                  </View>
                );
              })}
          </View>

          <Text style={styles.privacyNote}>
            Weekly totals only. Individual food logs remain private.
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 16,
  },
  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  headingText: {
    flex: 1,
  },
  sectionTitle: {
    color: "#202923",
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    color: "#879189",
    fontSize: 13,
    marginTop: 4,
  },
  refreshButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#EAF0EB",
  },
  refreshText: {
    color: "#557361",
    fontSize: 12,
    fontWeight: "700",
  },
  statusCard: {
    padding: 20,
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9EDE9",
  },
  muted: {
    color: "#849087",
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9,
    backgroundColor: "#EAF0EB",
  },
  retryText: {
    color: "#557361",
    fontWeight: "700",
    fontSize: 13,
  },
  summaryCard: {
    padding: 17,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9EDE9",
    marginBottom: 12,
  },
  summaryName: {
    color: "#202923",
    fontSize: 17,
    fontWeight: "700",
  },
  summaryUsername: {
    color: "#879189",
    fontSize: 13,
    marginTop: 3,
  },
  summaryStats: {
    flexDirection: "row",
    marginTop: 18,
  },
  summaryStat: {
    flex: 1,
  },
  statLabel: {
    color: "#879189",
    fontSize: 12,
  },
  statValue: {
    color: "#202923",
    fontSize: 23,
    fontWeight: "700",
    marginTop: 5,
  },
  statUnit: {
    color: "#879189",
    fontSize: 11,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#E9EDE9",
    marginHorizontal: 18,
  },
  chartCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9EDE9",
    padding: 15,
    marginBottom: 12,
  },
  chartTitle: {
    color: "#202923",
    fontSize: 15,
    fontWeight: "700",
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 12,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendBar: {
    width: 9,
    height: 9,
    borderRadius: 3,
    backgroundColor: "#729580",
  },
  legendGoalLine: {
    width: 13,
    height: 2,
    backgroundColor: "#C18B4A",
  },
  legendText: {
    color: "#879189",
    fontSize: 11,
  },
  chart: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    gap: 3,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  barValue: {
    color: "#657269",
    fontSize: 9,
    fontWeight: "600",
    marginBottom: 5,
  },
  barArea: {
    height: 106,
    width: "100%",
    maxWidth: 30,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#F5F7F4",
    borderRadius: 5,
    overflow: "hidden",
    position: "relative",
  },
  bar: {
    width: "70%",
    backgroundColor: "#729580",
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: "#C18B4A",
    zIndex: 1,
  },
  weekdayLabel: {
    color: "#657269",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 8,
  },
  dateLabel: {
    color: "#879189",
    fontSize: 9,
    marginTop: 3,
  },
  breakdownCard: {
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E9EDE9",
  },
  dayRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E9EDE9",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  dayInfo: {
    flex: 1,
  },
  dayName: {
    color: "#202923",
    fontSize: 13,
    fontWeight: "600",
  },
  dayGoal: {
    color: "#879189",
    fontSize: 11,
    marginTop: 4,
  },
  dayTotals: {
    alignItems: "flex-end",
  },
  dayCalories: {
    color: "#202923",
    fontSize: 16,
    fontWeight: "700",
  },
  dayKcal: {
    color: "#879189",
    fontSize: 10,
    marginTop: 1,
  },
  dayTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "#EDF1ED",
    overflow: "hidden",
    marginTop: 10,
  },
  dayFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#729580",
  },
  dayPercentage: {
    color: "#879189",
    fontSize: 10,
    marginTop: 5,
  },
  privacyNote: {
    color: "#879189",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 14,
  },
});
