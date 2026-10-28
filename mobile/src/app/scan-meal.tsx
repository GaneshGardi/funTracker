import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

type MealItem = {
  name: string;
  quantity_g: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

type MealResult = {
  meal_name: string;
  notes: string;
  items: MealItem[];
};

const nutritionFields = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'fiber', label: 'Fiber', unit: 'g' },
] as const;

function localDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numberValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export default function ScanMealScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [meal, setMeal] = useState<MealResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  async function chooseImage(source: 'camera' | 'gallery') {
    try {
      const permission =
        source === 'camera'
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Permission required',
          source === 'camera'
            ? 'Allow camera access in your device settings to take a meal photo.'
            : 'Allow photo-library access to choose a meal photo.',
        );
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      };

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled || !result.assets?.length) return;

      const asset = result.assets[0];

      if (!asset.base64) {
        Alert.alert(
          'Could not read photo',
          'Please choose another photo and try again.',
        );
        return;
      }

      if (
        asset.mimeType &&
        !['image/jpeg', 'image/png', 'image/webp'].includes(asset.mimeType)
      ) {
        Alert.alert(
          'Unsupported image',
          'Please select a JPEG, PNG, or WebP image.',
        );
        return;
      }

      setImageUri(asset.uri);
      setImageBase64(asset.base64);
      setMimeType(asset.mimeType ?? 'image/jpeg');
      setMeal(null);
    } catch (error) {
      Alert.alert(
        'Photo error',
        error instanceof Error ? error.message : 'Could not open the photo.',
      );
    }
  }

  async function analyzeMeal() {
    if (!imageBase64) {
      Alert.alert('Choose a photo', 'Take a photo or select one from your gallery.');
      return;
    }

    setAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-meal', {
        body: {
          image_base64: imageBase64,
          mime_type: mimeType,
        },
      });

      if (error) {
        throw new Error(error.message || 'Meal analysis failed.');
      }

      if (!data?.success || !data?.meal || !Array.isArray(data.meal.items)) {
        throw new Error(data?.error || 'The AI returned an invalid result.');
      }

      if (data.meal.items.length === 0) {
        Alert.alert(
          'No food detected',
          data.meal.notes || 'Try a clearer photo with the food visible.',
        );
        return;
      }

      setMeal({
        meal_name: String(data.meal.meal_name || 'Your meal'),
        notes: String(data.meal.notes || ''),
        items: data.meal.items.map((item: MealItem) => ({
          name: String(item.name),
          quantity_g: Number(item.quantity_g),
          calories: Number(item.calories),
          protein: Number(item.protein),
          carbs: Number(item.carbs),
          fat: Number(item.fat),
          fiber: Number(item.fiber),
        })),
      });
    } catch (error) {
      Alert.alert(
        'Analysis failed',
        error instanceof Error
          ? error.message
          : 'Could not analyze this meal. Please try again.',
      );
    } finally {
      setAnalyzing(false);
    }
  }

  function updateItem(
    index: number,
    field: keyof MealItem,
    value: string,
  ) {
    setMeal((current) => {
      if (!current) return current;

      const items = [...current.items];
      const existing = { ...items[index] };

      if (field === 'name') {
        existing.name = value;
      } else {
        // Keep partially typed numbers editable.
        const numericValue = value === '' ? 0 : Number(value);
        if (!Number.isFinite(numericValue) || numericValue < 0) {
          return current;
        }

        (existing[field] as number) = numericValue;
      }

      items[index] = existing;
      return { ...current, items };
    });
  }

  function removeItem(index: number) {
    setMeal((current) => {
      if (!current) return current;
      return {
        ...current,
        items: current.items.filter((_, i) => i !== index),
      };
    });
  }

  async function saveMeal() {
    if (!meal || meal.items.length === 0) {
      Alert.alert('No items to save', 'Analyze a meal and keep at least one item.');
      return;
    }

    for (const item of meal.items) {
      if (
        !item.name.trim() ||
        !Number.isFinite(item.quantity_g) ||
        item.quantity_g <= 0 ||
        ![
          item.calories,
          item.protein,
          item.carbs,
          item.fat,
          item.fiber,
        ].every((value) => Number.isFinite(value) && value >= 0)
      ) {
        Alert.alert(
          'Check your entries',
          'Each item needs a name, a positive quantity, and valid non-negative nutrition values.',
        );
        return;
      }
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke('save-ai-meal', {
        body: {
          log_date: localDateString(),
          items: meal.items.map((item) => ({
            name: item.name.trim(),
            quantity_g: item.quantity_g,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
          })),
        },
      });

      if (error) {
        throw new Error(error.message || 'Could not save meal.');
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Could not save meal.');
      }

      Alert.alert('Meal saved', 'Your reviewed food items have been added.', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)'),
        },
      ]);
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Could not save the meal. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  const totals = meal?.items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
      fiber: sum.fiber + item.fiber,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.title}>AI meal scanner</Text>
          <Text style={styles.subtitle}>
            Scan your plate and review the nutrition
          </Text>
        </View>
      </View>

      <View style={styles.photoCard}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.photo} />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoEmoji}>🍽️</Text>
            <Text style={styles.placeholderTitle}>What's on your plate?</Text>
            <Text style={styles.mutedText}>
              Choose a clear photo showing the food and portion sizes.
            </Text>
          </View>
        )}

        <View style={styles.photoButtons}>
          <Pressable
            style={styles.secondaryButton}
            disabled={analyzing || saving}
            onPress={() => chooseImage('camera')}
          >
            <Text style={styles.secondaryButtonText}>Take photo</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            disabled={analyzing || saving}
            onPress={() => chooseImage('gallery')}
          >
            <Text style={styles.secondaryButtonText}>Choose photo</Text>
          </Pressable>
        </View>
      </View>

      {imageBase64 && (
        <Pressable
          style={[styles.primaryButton, analyzing && styles.disabledButton]}
          disabled={analyzing || saving}
          onPress={analyzeMeal}
        >
          {analyzing ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color="#fff" />
              <Text style={styles.primaryButtonText}>Analyzing meal…</Text>
            </View>
          ) : (
            <Text style={styles.primaryButtonText}>Analyze with AI</Text>
          )}
        </Pressable>
      )}

      {meal && (
        <View style={styles.reviewSection}>
          <Text style={styles.sectionTitle}>Review your meal</Text>
          <Text style={styles.mutedText}>
            {meal.notes || 'Estimates are approximate. Edit them to match your meal.'}
          </Text>

          <TextInput
            value={meal.meal_name}
            onChangeText={(value) =>
              setMeal((current) =>
                current ? { ...current, meal_name: value } : current,
              )
            }
            style={styles.mealNameInput}
            placeholder="Meal name"
          />

          {meal.items.map((item, index) => (
            <View key={index} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemNumber}>Food {index + 1}</Text>
                <Pressable onPress={() => removeItem(index)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Food name</Text>
              <TextInput
                value={item.name}
                onChangeText={(value) => updateItem(index, 'name', value)}
                style={styles.input}
                placeholder="Food name"
              />

              <Text style={styles.fieldLabel}>Quantity (grams)</Text>
              <TextInput
                value={numberValue(item.quantity_g)}
                onChangeText={(value) => updateItem(index, 'quantity_g', value)}
                style={styles.input}
                keyboardType="decimal-pad"
              />

              <View style={styles.nutritionGrid}>
                {nutritionFields.map((field) => (
                  <View key={field.key} style={styles.nutritionField}>
                    <Text style={styles.fieldLabel}>
                      {field.label} ({field.unit})
                    </Text>
                    <TextInput
                      value={numberValue(item[field.key])}
                      onChangeText={(value) =>
                        updateItem(index, field.key, value)
                      }
                      style={styles.input}
                      keyboardType="decimal-pad"
                    />
                  </View>
                ))}
              </View>
            </View>
          ))}

          {totals && meal.items.length > 0 && (
            <View style={styles.totalsCard}>
              <Text style={styles.sectionTitle}>Meal totals</Text>
              <Text style={styles.totalCalories}>
                {Math.round(totals.calories)} kcal
              </Text>
              <Text style={styles.mutedText}>
                Protein {totals.protein.toFixed(1)} g · Carbs{' '}
                {totals.carbs.toFixed(1)} g
              </Text>
              <Text style={styles.mutedText}>
                Fat {totals.fat.toFixed(1)} g · Fiber{' '}
                {totals.fiber.toFixed(1)} g
              </Text>
            </View>
          )}

          <Text style={styles.disclaimer}>
            AI nutrition is an estimate, not a measurement. Review the values
            before saving.
          </Text>

          <Pressable
            style={[styles.primaryButton, saving && styles.disabledButton]}
            disabled={saving || analyzing}
            onPress={saveMeal}
          >
            {saving ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#fff" />
                <Text style={styles.primaryButtonText}>Saving…</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Confirm and save meal</Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  backText: {
    color: '#111',
    fontSize: 30,
    lineHeight: 34,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 4,
    color: '#777',
    fontSize: 13,
  },
  photoCard: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#f6f6f6',
  },
  photo: {
    width: '100%',
    height: 250,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  photoPlaceholder: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  photoEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#222',
    marginBottom: 8,
  },
  mutedText: {
    color: '#777',
    fontSize: 13,
    lineHeight: 19,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  secondaryButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  secondaryButtonText: {
    color: '#222',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#171717',
    borderRadius: 14,
    minHeight: 52,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewSection: {
    marginTop: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111',
    marginBottom: 10,
  },
  mealNameInput: {
    backgroundColor: '#f6f6f6',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    fontWeight: '600',
    color: '#111',
    marginTop: 16,
    marginBottom: 12,
  },
  itemCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  itemNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111',
  },
  removeText: {
    color: '#b42318',
    fontSize: 13,
    fontWeight: '600',
  },
  fieldLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: '#111',
    fontSize: 15,
    marginBottom: 12,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionField: {
    width: '48%',
  },
  totalsCard: {
    padding: 18,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    marginTop: 18,
  },
  totalCalories: {
    fontSize: 30,
    fontWeight: '700',
    color: '#111',
    marginBottom: 6,
  },
  disclaimer: {
    marginTop: 18,
    color: '#777',
    fontSize: 12,
    lineHeight: 18,
  },
});
