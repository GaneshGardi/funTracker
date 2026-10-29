
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
  notes?: string;
  items: MealItem[];
};

type NewFoodForm = {
  name: string;
  quantity_g: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
};

const emptyFood: NewFoodForm = {
  name: '',
  quantity_g: '100',
  calories: '',
  protein: '0',
  carbs: '0',
  fat: '0',
  fiber: '0',
};

const localDate = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const numberValue = (value: string) => Number(value.trim());

export default function ScanMealScreen() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState('image/jpeg');
  const [meal, setMeal] = useState<MealResult | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newFood, setNewFood] = useState<NewFoodForm>({ ...emptyFood });

  const totals = useMemo(() => {
    const items = meal?.items ?? [];

    return items.reduce(
      (total, item) => ({
        calories: total.calories + item.calories,
        protein: total.protein + item.protein,
        carbs: total.carbs + item.carbs,
        fat: total.fat + item.fat,
        fiber: total.fiber + item.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
    );
  }, [meal]);

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Camera permission required',
            'Allow camera access to take a meal photo.',
          );
          return;
        }
      } else {
        const permission =
          await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
          Alert.alert(
            'Photo permission required',
            'Allow photo library access to choose a meal photo.',
          );
          return;
        }
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            quality: 0.7,
            base64: true,
          });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];

      if (!asset.base64) {
        Alert.alert(
          'Could not read image',
          'Please choose the photo again.',
        );
        return;
      }

      setImageUri(asset.uri);
      setImageBase64(asset.base64);
      setMimeType(asset.mimeType || 'image/jpeg');
      setMeal(null);
      setShowAddForm(false);
      setNewFood({ ...emptyFood });
    } catch (error) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Could not select the image.');
    }
  };

  const analyzeMeal = async () => {
    if (!imageBase64) {
      Alert.alert('Choose a photo', 'Take or select a meal photo first.');
      return;
    }

    setAnalyzing(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'analyze-meal',
        {
          body: {
            image_base64: imageBase64,
            mime_type: mimeType,
          },
        },
      );

      if (error) throw error;
      if (!data?.success || !data?.meal) {
        throw new Error(data?.error || 'The meal could not be analyzed.');
      }

      const result = data.meal as MealResult;

      if (!Array.isArray(result.items)) {
        throw new Error('The analysis returned an invalid food list.');
      }

      setMeal({
        meal_name: result.meal_name || 'My meal',
        notes: result.notes || data.disclaimer || '',
        items: result.items.map((item) => ({
          name: String(item.name || 'Food item'),
          quantity_g: Number(item.quantity_g) || 100,
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          carbs: Number(item.carbs) || 0,
          fat: Number(item.fat) || 0,
          fiber: Number(item.fiber) || 0,
        })),
      });

      setShowAddForm(false);
    } catch (error) {
      console.error('Meal analysis error:', error);
      Alert.alert(
        'Analysis failed',
        error instanceof Error
          ? error.message
          : 'Could not analyze the photo. Please try again.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const updateItem = (
    index: number,
    field: keyof MealItem,
    value: string,
  ) => {
    if (!meal) return;

    setMeal((current) => {
      if (!current) return current;

      const items = [...current.items];
      const item = { ...items[index] };

      if (field === 'name') {
        item.name = value;
      } else {
        const numericValue = Number(value);
        if (value.trim() === '' || !Number.isFinite(numericValue)) {
          return current;
        }
        item[field] = Math.max(0, numericValue);
      }

      items[index] = item;
      return { ...current, items };
    });
  };

  const removeItem = (index: number) => {
    setMeal((current) =>
      current
        ? {
            ...current,
            items: current.items.filter((_, i) => i !== index),
          }
        : current,
    );
  };

  const updateNewFood = (field: keyof NewFoodForm, value: string) => {
    setNewFood((current) => ({ ...current, [field]: value }));
  };

  const addFoodItem = () => {
    const name = newFood.name.trim();
    const quantity = numberValue(newFood.quantity_g);
    const calories = numberValue(newFood.calories);
    const protein = numberValue(newFood.protein);
    const carbs = numberValue(newFood.carbs);
    const fat = numberValue(newFood.fat);
    const fiber = numberValue(newFood.fiber);

    if (!name) {
      Alert.alert('Food name required', 'Enter the name of your food.');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      Alert.alert('Invalid quantity', 'Quantity must be greater than zero.');
      return;
    }

    const nutritionValues = [calories, protein, carbs, fat, fiber];

    if (
      nutritionValues.some(
        (value) => !Number.isFinite(value) || value < 0,
      )
    ) {
      Alert.alert(
        'Invalid nutrition values',
        'Enter valid, non-negative numbers for all nutrition fields.',
      );
      return;
    }

    if (!meal) return;

    const item: MealItem = {
      name,
      quantity_g: quantity,
      calories,
      protein,
      carbs,
      fat,
      fiber,
    };

    setMeal((current) =>
      current
        ? { ...current, items: [...current.items, item] }
        : current,
    );

    setNewFood({ ...emptyFood });
    setShowAddForm(false);
  };

  const saveMeal = async () => {
    if (!meal || meal.items.length === 0) {
      Alert.alert('No food items', 'Add at least one food item before saving.');
      return;
    }

    setSaving(true);

    try {
      const { data, error } = await supabase.functions.invoke(
        'save-ai-meal',
        {
          body: {
            log_date: localDate(),
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
        },
      );

      if (error) throw error;
      if (!data?.success) {
        throw new Error(data?.error || 'The meal could not be saved.');
      }

      Alert.alert(
        'Meal saved',
        'Your food items have been added to today’s calorie log.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ],
      );
    } catch (error) {
      console.error('Save meal error:', error);
      Alert.alert(
        'Save failed',
        error instanceof Error
          ? error.message
          : 'Could not save the meal. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const renderNutritionInput = (
    label: string,
    field: keyof NewFoodForm,
    placeholder: string,
  ) => (
    <View style={styles.nutritionInput} key={field}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={newFood[field]}
        onChangeText={(value) => updateNewFood(field, value)}
        keyboardType="decimal-pad"
        placeholder={placeholder}
        placeholderTextColor="#777"
      />
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Back</Text>
          </Pressable>

          <Text style={styles.title}>Scan your meal</Text>
          <Text style={styles.subtitle}>
            Take a photo or choose one to estimate its nutrition.
          </Text>
        </View>

        <View style={styles.imageActions}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => pickImage(true)}
            disabled={analyzing || saving}
          >
            <Text style={styles.secondaryButtonText}>Take photo</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryButton}
            onPress={() => pickImage(false)}
            disabled={analyzing || saving}
          >
            <Text style={styles.secondaryButtonText}>Choose photo</Text>
          </Pressable>
        </View>

        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.mealImage} />
        ) : (
          <View style={styles.imagePlaceholder}>
            <Text style={styles.placeholderIcon}>＋</Text>
            <Text style={styles.placeholderText}>
              Your meal photo will appear here
            </Text>
          </View>
        )}

        <Pressable
          style={[
            styles.primaryButton,
            (!imageBase64 || analyzing || saving) && styles.disabledButton,
          ]}
          onPress={analyzeMeal}
          disabled={!imageBase64 || analyzing || saving}
        >
          {analyzing ? (
            <ActivityIndicator color="#101010" />
          ) : (
            <Text style={styles.primaryButtonText}>Analyze meal</Text>
          )}
        </Pressable>

        {analyzing && (
          <Text style={styles.statusText}>
            Analyzing the photo. This may take a few seconds…
          </Text>
        )}

        {meal && (
          <View style={styles.results}>
            <Text style={styles.sectionTitle}>
              {meal.meal_name || 'Detected food'}
            </Text>

            {!!meal.notes && (
              <Text style={styles.note}>{meal.notes}</Text>
            )}

            <Text style={styles.helperText}>
              Review and edit the estimates before saving. Nutrition values
              are estimates for each item’s listed portion.
            </Text>

            {meal.items.map((item, index) => (
              <View style={styles.foodCard} key={`food-${index}`}>
                <View style={styles.foodCardHeader}>
                  <Text style={styles.foodNumber}>ITEM {index + 1}</Text>
                  <Pressable
                    onPress={() => removeItem(index)}
                    hitSlop={8}
                  >
                    <Text style={styles.removeText}>Remove</Text>
                  </Pressable>
                </View>

                <Text style={styles.inputLabel}>Food name</Text>
                <TextInput
                  style={styles.input}
                  value={item.name}
                  onChangeText={(value) =>
                    updateItem(index, 'name', value)
                  }
                  placeholder="Food name"
                  placeholderTextColor="#777"
                />

                <Text style={styles.inputLabel}>Quantity (g)</Text>
                <TextInput
                  style={styles.input}
                  value={String(item.quantity_g)}
                  onChangeText={(value) =>
                    updateItem(index, 'quantity_g', value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="Quantity in grams"
                  placeholderTextColor="#777"
                />

                <View style={styles.nutritionGrid}>
                  {(
                    [
                      ['Calories', 'calories'],
                      ['Protein (g)', 'protein'],
                      ['Carbs (g)', 'carbs'],
                      ['Fat (g)', 'fat'],
                      ['Fiber (g)', 'fiber'],
                    ] as const
                  ).map(([label, field]) => (
                    <View style={styles.nutritionInput} key={field}>
                      <Text style={styles.inputLabel}>{label}</Text>
                      <TextInput
                        style={styles.input}
                        value={String(item[field])}
                        onChangeText={(value) =>
                          updateItem(index, field, value)
                        }
                        keyboardType="decimal-pad"
                        placeholder="0"
                        placeholderTextColor="#777"
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}

            {/* ADD FOOD ITEM BUTTON: always visible after analysis */}
            <Pressable
              style={styles.addFoodButton}
              onPress={() => setShowAddForm((visible) => !visible)}
            >
              <Text style={styles.addFoodIcon}>
                {showAddForm ? '−' : '+'}
              </Text>
              <View style={styles.addFoodTextContainer}>
                <Text style={styles.addFoodTitle}>
                  {showAddForm ? 'Cancel adding food' : 'Add food item'}
                </Text>
                <Text style={styles.addFoodSubtitle}>
                  Add a food the scanner missed
                </Text>
              </View>
            </Pressable>

            {showAddForm && (
              <View style={styles.addForm}>
                <Text style={styles.addFormTitle}>
                  Enter food details
                </Text>
                <Text style={styles.formHint}>
                  Enter nutrition values for the entire quantity you specify,
                  not per 100 g unless your quantity is 100 g.
                </Text>

                <Text style={styles.inputLabel}>Food name *</Text>
                <TextInput
                  style={styles.input}
                  value={newFood.name}
                  onChangeText={(value) =>
                    updateNewFood('name', value)
                  }
                  placeholder="e.g. Chapati"
                  placeholderTextColor="#777"
                />

                <Text style={styles.inputLabel}>Quantity (g) *</Text>
                <TextInput
                  style={styles.input}
                  value={newFood.quantity_g}
                  onChangeText={(value) =>
                    updateNewFood('quantity_g', value)
                  }
                  keyboardType="decimal-pad"
                  placeholder="100"
                  placeholderTextColor="#777"
                />

                <View style={styles.nutritionGrid}>
                  {renderNutritionInput(
                    'Calories (kcal) *',
                    'calories',
                    '0',
                  )}
                  {renderNutritionInput(
                    'Protein (g) *',
                    'protein',
                    '0',
                  )}
                  {renderNutritionInput(
                    'Carbs (g) *',
                    'carbs',
                    '0',
                  )}
                  {renderNutritionInput('Fat (g) *', 'fat', '0')}
                  {renderNutritionInput(
                    'Fiber (g) *',
                    'fiber',
                    '0',
                  )}
                </View>

                <Pressable
                  style={styles.saveAddedFoodButton}
                  onPress={addFoodItem}
                >
                  <Text style={styles.saveAddedFoodText}>
                    Add to meal
                  </Text>
                </Pressable>
              </View>
            )}

            <View style={styles.totalsCard}>
              <Text style={styles.sectionTitle}>Meal totals</Text>

              <View style={styles.calorieRow}>
                <Text style={styles.calorieLabel}>Calories</Text>
                <Text style={styles.calorieValue}>
                  {Math.round(totals.calories)} kcal
                </Text>
              </View>

              <View style={styles.totalMacros}>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>
                    {totals.protein.toFixed(1)} g
                  </Text>
                  <Text style={styles.macroLabel}>Protein</Text>
                </View>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>
                    {totals.carbs.toFixed(1)} g
                  </Text>
                  <Text style={styles.macroLabel}>Carbs</Text>
                </View>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>
                    {totals.fat.toFixed(1)} g
                  </Text>
                  <Text style={styles.macroLabel}>Fat</Text>
                </View>
                <View style={styles.macro}>
                  <Text style={styles.macroValue}>
                    {totals.fiber.toFixed(1)} g
                  </Text>
                  <Text style={styles.macroLabel}>Fiber</Text>
                </View>
              </View>
            </View>

            <Pressable
              style={[
                styles.primaryButton,
                (saving || analyzing || meal.items.length === 0) &&
                  styles.disabledButton,
              ]}
              onPress={saveMeal}
              disabled={saving || analyzing || meal.items.length === 0}
            >
              {saving ? (
                <ActivityIndicator color="#101010" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  Save meal to today
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101010',
  },
  container: {
    padding: 20,
    paddingBottom: 48,
  },
  header: {
    marginBottom: 20,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 12,
  },
  backText: {
    color: '#B6F36B',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: '#A5A5A5',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  imageActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#383838',
    backgroundColor: '#1B1B1B',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  mealImage: {
    width: '100%',
    height: 230,
    borderRadius: 16,
    backgroundColor: '#1B1B1B',
    marginBottom: 16,
  },
  imagePlaceholder: {
    height: 180,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#383838',
    borderStyle: 'dashed',
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  placeholderIcon: {
    color: '#B6F36B',
    fontSize: 36,
    marginBottom: 8,
  },
  placeholderText: {
    color: '#999999',
    fontSize: 14,
  },
  primaryButton: {
    backgroundColor: '#B6F36B',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginBottom: 12,
  },
  primaryButtonText: {
    color: '#101010',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledButton: {
    opacity: 0.45,
  },
  statusText: {
    color: '#B6F36B',
    textAlign: 'center',
    marginVertical: 12,
  },
  results: {
    marginTop: 20,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 12,
  },
  note: {
    color: '#B6F36B',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  helperText: {
    color: '#999999',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 16,
  },
  foodCard: {
    backgroundColor: '#1A1A1A',
    borderColor: '#303030',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  foodCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  foodNumber: {
    color: '#B6F36B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  removeText: {
    color: '#FF7777',
    fontSize: 13,
    fontWeight: '600',
  },
  inputLabel: {
    color: '#BBBBBB',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#252525',
    borderColor: '#3A3A3A',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#FFFFFF',
    fontSize: 14,
    minHeight: 44,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  nutritionInput: {
    width: '47%',
    flexGrow: 1,
  },
  addFoodButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A2415',
    borderWidth: 1,
    borderColor: '#638A3E',
    borderRadius: 14,
    padding: 15,
    marginTop: 2,
    marginBottom: 16,
  },
  addFoodIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#B6F36B',
    color: '#101010',
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 38,
    fontSize: 26,
    fontWeight: '500',
    overflow: 'hidden',
    marginRight: 12,
  },
  addFoodTextContainer: {
    flex: 1,
  },
  addFoodTitle: {
    color: '#B6F36B',
    fontSize: 15,
    fontWeight: '800',
  },
  addFoodSubtitle: {
    color: '#A5A5A5',
    fontSize: 12,
    marginTop: 4,
  },
  addForm: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#638A3E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  addFormTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  formHint: {
    color: '#999999',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 8,
    marginBottom: 6,
  },
  saveAddedFoodButton: {
    backgroundColor: '#B6F36B',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  saveAddedFoodText: {
    color: '#101010',
    fontWeight: '800',
    fontSize: 15,
  },
  totalsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#303030',
    padding: 16,
    marginTop: 4,
    marginBottom: 18,
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
    paddingBottom: 14,
  },
  calorieLabel: {
    color: '#BBBBBB',
    fontSize: 14,
  },
  calorieValue: {
    color: '#B6F36B',
    fontSize: 22,
    fontWeight: '800',
  },
  totalMacros: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 14,
  },
  macro: {
    minWidth: '20%',
    flexGrow: 1,
  },
  macroValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  macroLabel: {
    color: '#999999',
    fontSize: 12,
    marginTop: 4,
  },
});
