
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

const C = {
  background: "#101010",
  card: "#1A1A1A",
  input: "#141414",
  accent: "#B6F36B",
  text: "#FFFFFF",
  secondary: "#A0A0A0",
  muted: "#707070",
  border: "#303030",
  danger: "#FF7777",
  goal: "#D8B66A",
};

const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getDateLabel = (dateString: string) => {
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
        }
      );

      if (fetchError) throw fetchError;

      const rows = (data ?? []) as WeeklyHistoryRow[];

      setHistory(
        rows
          .filter((row) => row.user_id === memberId)
          .slice()
          .sort((a, b) => a.log_date.localeCompare(b.log_date))
      );
    } catch (err) {
      console.error("Failed to load member weekly history:", err);
      setHistory([]);
      setError(
        "Couldn't load weekly history. Refresh and try again."
      );
    } finally {
      setLoading(false);
    }
  }, [groupId, memberId]);

  useFocusEffect(
    useCallback(() => {
      void loadHistory();
    }, [loadHistory, refreshToken])
  );

  const selectedDays = history;
  const selectedMember = selectedDays[0];

  const totalCalories = selectedDays.reduce(
    (sum, day) => sum + getCalories(day.calories_consumed),
    0
  );

  const averageCalories =
    selectedDays.length > 0 ? totalCalories / selectedDays.length : 0;

  const chartMaximum = Math.max(
    1,
    ...selectedDays.map((day) =>
      Math.max(
        getCalories(day.calories_consumed),
        getCalories(day.daily_calorie_goal)
      )
    )
  );

  const initials = selectedMember
    ? (
        selectedMember.display_name?.trim() ||
        selectedMember.username ||
        "?"
      )
        .charAt(0)
        .toUpperCase()
    : "?";

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View style={styles.headingText}>
          <Text style={styles.eyebrow}>GROUP ACTIVITY</Text>
          <Text style={styles.sectionTitle}>Weekly history</Text>
          <Text style={styles.subtitle}>
            Last 7 days · Calories only
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Refresh weekly history"
          style={({ pressed }) => [
            styles.refreshButton,
            pressed && styles.pressed,
            loading && styles.disabled,
          ]}
          onPress={() => void loadHistory()}
          disabled={loading}
        >
          <Text style={styles.refreshIcon}>↻</Text>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.statusCard}>
          <ActivityIndicator color={C.accent} size="large" />
          <Text style={styles.muted}>Loading weekly history...</Text>
        </View>
      ) : error ? (
        <View style={styles.statusCard}>
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>!</Text>
          </View>
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
          <View style={styles.statusIcon}>
            <Text style={styles.statusIconText}>↗</Text>
          </View>
          <Text style={styles.emptyTitle}>No history yet</Text>
          <Text style={styles.muted}>
            Weekly calorie history will appear here when data is available
            for this member.
          </Text>
        </View>
      ) : (
        <>
          {/* Member overview */}
          <View style={styles.summaryCard}>
            <View style={styles.memberRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>

              <View style={styles.memberInfo}>
                <Text style={styles.summaryName}>
                  {selectedMember.display_name?.trim() ||
                    selectedMember.username}
                </Text>
                <Text style={styles.summaryUsername}>
                  @{selectedMember.username}
                </Text>
              </View>

              <View style={styles.weekBadge}>
                <Text style={styles.weekBadgeText}>7 DAYS</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.summaryStats}>
              <View style={styles.summaryStat}>
                <Text style={styles.statLabel}>TOTAL CONSUMED</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>
                    {Math.round(totalCalories).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.statUnit}>kcal this week</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.summaryStat}>
                <Text style={styles.statLabel}>DAILY AVERAGE</Text>
                <View style={styles.statValueRow}>
                  <Text style={styles.statValue}>
                    {Math.round(averageCalories).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.statUnit}>kcal per day</Text>
              </View>
            </View>
          </View>

          {/* Weekly chart */}
          <View style={styles.chartCard}>
            <View style={styles.chartHeader}>
              <View>
                <Text style={styles.chartTitle}>Daily calories</Text>
                <Text style={styles.chartSubtitle}>
                  Intake compared with daily goal
                </Text>
              </View>
              <View style={styles.chartIcon}>
                <Text style={styles.chartIconText}>▥</Text>
              </View>
            </View>

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

          {/* Daily details */}
          <View style={styles.breakdownCard}>
            <View style={styles.breakdownHeader}>
              <View>
                <Text style={styles.chartTitle}>Daily breakdown</Text>
                <Text style={styles.chartSubtitle}>
                  Your friend's daily progress
                </Text>
              </View>
              <Text style={styles.breakdownCount}>
                {selectedDays.length} DAYS
              </Text>
            </View>

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
                const metGoal =
                  percentage !== null && percentage >= 100;

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
                              metGoal && styles.dayFillMet,
                            ]}
                          />
                        </View>

                        <View style={styles.percentageRow}>
                          <Text style={styles.dayPercentage}>
                            {percentage}% of goal
                          </Text>
                          <Text
                            style={[
                              styles.goalStatus,
                              metGoal && styles.goalStatusMet,
                            ]}
                          >
                            {metGoal ? "Goal reached" : "In progress"}
                          </Text>
                        </View>
                      </>
                    )}
                  </View>
                );
              })}
          </View>

          <View style={styles.privacyNote}>
            <Text style={styles.privacyIcon}>⌑</Text>
            <Text style={styles.privacyText}>
              Weekly calorie totals only. Individual food logs remain private.
            </Text>
          </View>
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
    marginBottom: 16,
    gap: 12,
  },
  headingText: {
    flex: 1,
  },
  eyebrow: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.7,
    marginBottom: 6,
  },
  sectionTitle: {
    color: C.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  subtitle: {
    color: C.secondary,
    fontSize: 12,
    marginTop: 5,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
  },
  refreshIcon: {
    color: C.accent,
    fontSize: 17,
    fontWeight: "700",
  },
  refreshText: {
    color: C.text,
    fontSize: 11,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
  disabled: {
    opacity: 0.5,
  },
  statusCard: {
    padding: 24,
    alignItems: "center",
    gap: 12,
    backgroundColor: C.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: C.border,
  },
  muted: {
    color: C.secondary,
    fontSize: 12,
    lineHeight: 19,
    textAlign: "center",
  },
  errorText: {
    color: C.danger,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 19,
  },
  statusIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#252C1E",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconText: {
    color: C.accent,
    fontSize: 22,
    fontWeight: "800",
  },
  emptyTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: "800",
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: C.accent,
  },
  retryText: {
    color: C.background,
    fontWeight: "900",
    fontSize: 12,
  },

  summaryCard: {
    padding: 17,
    backgroundColor: C.card,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: C.background,
    fontSize: 20,
    fontWeight: "900",
  },
  memberInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },
  summaryName: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
  },
  summaryUsername: {
    color: C.secondary,
    fontSize: 11,
    marginTop: 4,
  },
  weekBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#252C1E",
    borderWidth: 1,
    borderColor: "#39482A",
  },
  weekBadgeText: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 17,
  },
  summaryStats: {
    flexDirection: "row",
  },
  summaryStat: {
    flex: 1,
  },
  statLabel: {
    color: C.secondary,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 7,
  },
  statValue: {
    color: C.text,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  statUnit: {
    color: C.muted,
    fontSize: 10,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: C.border,
    marginHorizontal: 15,
  },

  chartCard: {
    backgroundColor: C.card,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.border,
    padding: 16,
    marginBottom: 12,
  },
  chartHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chartTitle: {
    color: C.text,
    fontSize: 15,
    fontWeight: "800",
  },
  chartSubtitle: {
    color: C.secondary,
    fontSize: 11,
    marginTop: 5,
  },
  chartIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#252C1E",
    borderWidth: 1,
    borderColor: "#39482A",
    alignItems: "center",
    justifyContent: "center",
  },
  chartIconText: {
    color: C.accent,
    fontSize: 21,
    fontWeight: "800",
  },
  legendRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 18,
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
    backgroundColor: C.accent,
  },
  legendGoalLine: {
    width: 13,
    height: 2,
    backgroundColor: C.goal,
  },
  legendText: {
    color: C.secondary,
    fontSize: 10,
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
    color: C.secondary,
    fontSize: 9,
    fontWeight: "700",
    marginBottom: 6,
  },
  barArea: {
    height: 106,
    width: "100%",
    maxWidth: 30,
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: C.input,
    borderRadius: 6,
    overflow: "hidden",
    position: "relative",
  },
  bar: {
    width: "70%",
    backgroundColor: C.accent,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  goalLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: C.goal,
    zIndex: 1,
  },
  weekdayLabel: {
    color: C.text,
    fontSize: 10,
    fontWeight: "700",
    marginTop: 9,
  },
  dateLabel: {
    color: C.muted,
    fontSize: 9,
    marginTop: 3,
  },

  breakdownCard: {
    paddingHorizontal: 16,
    paddingTop: 17,
    paddingBottom: 4,
    backgroundColor: C.card,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: C.border,
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  breakdownCount: {
    color: C.accent,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.7,
  },
  dayRow: {
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
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
    color: C.text,
    fontSize: 12,
    fontWeight: "700",
  },
  dayGoal: {
    color: C.secondary,
    fontSize: 10,
    marginTop: 5,
  },
  dayTotals: {
    alignItems: "flex-end",
  },
  dayCalories: {
    color: C.text,
    fontSize: 16,
    fontWeight: "900",
  },
  dayKcal: {
    color: C.secondary,
    fontSize: 10,
    marginTop: 2,
  },
  dayTrack: {
    height: 5,
    borderRadius: 5,
    backgroundColor: "#30352B",
    overflow: "hidden",
    marginTop: 12,
  },
  dayFill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: C.goal,
  },
  dayFillMet: {
    backgroundColor: C.accent,
  },
  percentageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 7,
  },
  dayPercentage: {
    color: C.secondary,
    fontSize: 10,
  },
  goalStatus: {
    color: C.goal,
    fontSize: 10,
    fontWeight: "700",
  },
  goalStatusMet: {
    color: C.accent,
  },

  privacyNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 15,
    paddingHorizontal: 8,
  },
  privacyIcon: {
    color: C.accent,
    fontSize: 17,
    fontWeight: "800",
  },
  privacyText: {
    flex: 1,
    color: C.muted,
    fontSize: 10,
    lineHeight: 16,
    textAlign: "center",
  },
});
