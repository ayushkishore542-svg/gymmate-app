/**
 * Seed script — 100+ Indian foods
 * Run: node backend/utils/seedFoods.js
 *
 * Macros are per 1 unit (1 roti, 1 cup rice cooked, 100g, etc.)
 * The `unit` field tells the frontend what "1" means.
 */

const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const Food = require('../models/Food');

const foods = [
  // ─── Cereals & Grains ─────────────────────────────────────────────────────
  {
    name: 'Roti (Wheat Chapati)',
    category: 'grains',
    calories: 71, protein: 2.7, carbs: 14.9, fats: 0.4, fiber: 2.7,
    serving_size: 1, unit: 'roti (30g)',
    search_keywords: ['chapati','phulka','wheat roti','atta roti','wholemeal'],
    verified: true, use_count: 50
  },
  {
    name: 'Rice (Cooked White)',
    category: 'grains',
    calories: 130, protein: 2.7, carbs: 28.2, fats: 0.3, fiber: 0.4,
    serving_size: 1, unit: 'cup (180g)',
    search_keywords: ['chawal','steamed rice','plain rice','boiled rice'],
    verified: true, use_count: 45
  },
  {
    name: 'Brown Rice (Cooked)',
    category: 'grains',
    calories: 216, protein: 5, carbs: 44, fats: 1.8, fiber: 3.5,
    serving_size: 1, unit: 'cup (195g)',
    search_keywords: ['brown rice','whole grain rice','bran rice'],
    verified: true, use_count: 20
  },
  {
    name: 'Paratha (Plain)',
    category: 'grains',
    calories: 180, protein: 4, carbs: 24, fats: 7.5, fiber: 2,
    serving_size: 1, unit: 'paratha (60g)',
    search_keywords: ['paratha','parantha','tawa bread'],
    verified: true, use_count: 30
  },
  {
    name: 'Aloo Paratha',
    category: 'grains',
    calories: 250, protein: 5, carbs: 35, fats: 10, fiber: 3,
    serving_size: 1, unit: 'paratha (100g)',
    search_keywords: ['potato paratha','stuffed paratha','aloo parantha'],
    verified: true, use_count: 22
  },
  {
    name: 'Idli',
    category: 'grains',
    calories: 39, protein: 1.8, carbs: 7.6, fats: 0.2, fiber: 0.5,
    serving_size: 1, unit: 'idli (50g)',
    search_keywords: ['idly','south indian','fermented rice'],
    verified: true, use_count: 25
  },
  {
    name: 'Dosa (Plain)',
    category: 'grains',
    calories: 133, protein: 3.4, carbs: 24.4, fats: 2.7, fiber: 0.8,
    serving_size: 1, unit: 'dosa (75g)',
    search_keywords: ['dosai','crepe','south indian breakfast','masala dosa'],
    verified: true, use_count: 28
  },
  {
    name: 'Upma',
    category: 'grains',
    calories: 177, protein: 4.5, carbs: 29, fats: 5, fiber: 2,
    serving_size: 1, unit: 'cup (150g)',
    search_keywords: ['semolina upma','sooji upma','rava upma'],
    verified: true, use_count: 18
  },
  {
    name: 'Poha',
    category: 'grains',
    calories: 250, protein: 4, carbs: 47, fats: 5, fiber: 1.5,
    serving_size: 1, unit: 'plate (150g)',
    search_keywords: ['flattened rice','aval','pohe','beaten rice'],
    verified: true, use_count: 20
  },
  {
    name: 'Oats (Cooked)',
    category: 'grains',
    calories: 166, protein: 5.9, carbs: 28, fats: 3.6, fiber: 4,
    serving_size: 1, unit: 'cup (240g)',
    search_keywords: ['oatmeal','porridge','rolled oats','quaker'],
    verified: true, use_count: 35
  },
  {
    name: 'Bread (White Slice)',
    category: 'grains',
    calories: 79, protein: 2.7, carbs: 15.1, fats: 1, fiber: 0.6,
    serving_size: 1, unit: 'slice (30g)',
    search_keywords: ['white bread','toast','sandwich bread'],
    verified: true, use_count: 18
  },
  {
    name: 'Multigrain Bread',
    category: 'grains',
    calories: 69, protein: 3.5, carbs: 11.5, fats: 1.2, fiber: 2.5,
    serving_size: 1, unit: 'slice (30g)',
    search_keywords: ['whole wheat bread','brown bread','healthy bread'],
    verified: true, use_count: 15
  },

  // ─── Pulses & Legumes ─────────────────────────────────────────────────────
  {
    name: 'Moong Dal (Cooked)',
    category: 'pulses',
    calories: 104, protein: 7, carbs: 18, fats: 0.4, fiber: 2,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['mung dal','green moong','yellow moong','moong lentil'],
    verified: true, use_count: 30
  },
  {
    name: 'Chana Dal (Cooked)',
    category: 'pulses',
    calories: 180, protein: 10, carbs: 30, fats: 3, fiber: 8,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['split chickpea','bengal gram dal'],
    verified: true, use_count: 22
  },
  {
    name: 'Toor Dal (Cooked)',
    category: 'pulses',
    calories: 132, protein: 8, carbs: 23, fats: 0.4, fiber: 5,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['arhar dal','pigeon pea dal','tuvar dal'],
    verified: true, use_count: 35
  },
  {
    name: 'Rajma (Kidney Beans, Cooked)',
    category: 'pulses',
    calories: 215, protein: 15, carbs: 38, fats: 0.9, fiber: 11,
    serving_size: 1, unit: 'cup (180g)',
    search_keywords: ['kidney beans','rajma chawal','red kidney beans'],
    verified: true, use_count: 28
  },
  {
    name: 'Chole (Chickpeas, Cooked)',
    category: 'pulses',
    calories: 269, protein: 15, carbs: 45, fats: 4, fiber: 12,
    serving_size: 1, unit: 'cup (180g)',
    search_keywords: ['chana','chickpeas','kabuli chana','garbanzo'],
    verified: true, use_count: 32
  },
  {
    name: 'Masoor Dal (Cooked)',
    category: 'pulses',
    calories: 116, protein: 9, carbs: 20, fats: 0.4, fiber: 4,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['red lentil','pink lentil','masur dal'],
    verified: true, use_count: 24
  },
  {
    name: 'Sprouts (Mixed)',
    category: 'pulses',
    calories: 62, protein: 4.5, carbs: 8, fats: 0.5, fiber: 2,
    serving_size: 1, unit: 'cup (100g)',
    search_keywords: ['moong sprouts','bean sprouts','germinated beans'],
    verified: true, use_count: 20
  },

  // ─── Poultry & Meat ──────────────────────────────────────────────────────
  {
    name: 'Chicken Breast (Cooked)',
    category: 'meat',
    calories: 165, protein: 31, carbs: 0, fats: 3.6, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['chicken','grilled chicken','boiled chicken','boneless chicken'],
    verified: true, use_count: 60
  },
  {
    name: 'Chicken Leg (Cooked)',
    category: 'meat',
    calories: 184, protein: 26, carbs: 0, fats: 8.5, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['chicken leg','drumstick chicken','chicken thigh'],
    verified: true, use_count: 35
  },
  {
    name: 'Chicken Curry (1 piece)',
    category: 'meat',
    calories: 220, protein: 22, carbs: 5, fats: 12, fiber: 0.5,
    serving_size: 1, unit: 'piece+gravy (150g)',
    search_keywords: ['chicken curry','murgh','murg curry'],
    verified: true, use_count: 40
  },
  {
    name: 'Egg (Whole, Boiled)',
    category: 'eggs',
    calories: 78, protein: 6, carbs: 0.6, fats: 5, fiber: 0,
    serving_size: 1, unit: 'large egg (50g)',
    search_keywords: ['anda','boiled egg','hard boiled egg','egg'],
    verified: true, use_count: 70
  },
  {
    name: 'Egg White',
    category: 'eggs',
    calories: 17, protein: 3.6, carbs: 0.2, fats: 0.1, fiber: 0,
    serving_size: 1, unit: 'egg white (33g)',
    search_keywords: ['egg white','albumen','white of egg'],
    verified: true, use_count: 45
  },
  {
    name: 'Egg (Fried/Omelette)',
    category: 'eggs',
    calories: 114, protein: 7, carbs: 0.4, fats: 9, fiber: 0,
    serving_size: 1, unit: 'omelette (60g)',
    search_keywords: ['fried egg','omelette','omlet','scrambled egg'],
    verified: true, use_count: 38
  },
  {
    name: 'Mutton/Lamb (Cooked)',
    category: 'meat',
    calories: 294, protein: 26, carbs: 0, fats: 20, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['mutton','lamb','goat meat','bakra'],
    verified: true, use_count: 20
  },
  {
    name: 'Fish (Rohu/Catla, Cooked)',
    category: 'seafood',
    calories: 147, protein: 22, carbs: 0, fats: 6, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['fish','rohu','catla','freshwater fish','machhi'],
    verified: true, use_count: 22
  },
  {
    name: 'Tuna (Canned in Water)',
    category: 'seafood',
    calories: 116, protein: 26, carbs: 0, fats: 1, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['tuna fish','canned tuna','tuna can'],
    verified: true, use_count: 18
  },

  // ─── Dairy ───────────────────────────────────────────────────────────────
  {
    name: 'Milk (Full Fat)',
    category: 'dairy',
    calories: 150, protein: 8, carbs: 11.7, fats: 8, fiber: 0,
    serving_size: 1, unit: 'glass (240ml)',
    search_keywords: ['whole milk','doodh','cow milk','buffalo milk'],
    verified: true, use_count: 40
  },
  {
    name: 'Milk (Skimmed/Toned)',
    category: 'dairy',
    calories: 90, protein: 9, carbs: 12, fats: 0.5, fiber: 0,
    serving_size: 1, unit: 'glass (240ml)',
    search_keywords: ['skim milk','low fat milk','toned milk','double toned'],
    verified: true, use_count: 28
  },
  {
    name: 'Paneer (Cottage Cheese)',
    category: 'dairy',
    calories: 265, protein: 18, carbs: 3.4, fats: 20, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['paneer','cottage cheese','indian cheese','fresh cheese'],
    verified: true, use_count: 50
  },
  {
    name: 'Curd / Dahi (Full Fat)',
    category: 'dairy',
    calories: 98, protein: 3.5, carbs: 3.4, fats: 5, fiber: 0,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['yogurt','dahi','curd','plain yogurt','probiotic'],
    verified: true, use_count: 42
  },
  {
    name: 'Greek Yogurt',
    category: 'dairy',
    calories: 100, protein: 10, carbs: 3.6, fats: 5, fiber: 0,
    serving_size: 1, unit: 'cup (170g)',
    search_keywords: ['greek yoghurt','thick curd','hung curd','strained yogurt'],
    verified: true, use_count: 30
  },
  {
    name: 'Ghee',
    category: 'fats',
    calories: 112, protein: 0, carbs: 0, fats: 12.7, fiber: 0,
    serving_size: 1, unit: 'tbsp (14g)',
    search_keywords: ['clarified butter','desi ghee','ghee'],
    verified: true, use_count: 35
  },
  {
    name: 'Butter',
    category: 'fats',
    calories: 102, protein: 0.1, carbs: 0.1, fats: 11.5, fiber: 0,
    serving_size: 1, unit: 'tbsp (14g)',
    search_keywords: ['salted butter','amul butter','white butter'],
    verified: true, use_count: 22
  },
  {
    name: 'Whey Protein (1 scoop)',
    category: 'supplements',
    calories: 120, protein: 24, carbs: 3, fats: 1.5, fiber: 0,
    serving_size: 1, unit: 'scoop (30g)',
    search_keywords: ['whey','protein powder','protein shake','supplement'],
    verified: true, use_count: 55
  },

  // ─── Vegetables ──────────────────────────────────────────────────────────
  {
    name: 'Aloo Sabzi (Potato Curry)',
    category: 'vegetables',
    calories: 180, protein: 3, carbs: 30, fats: 6, fiber: 3,
    serving_size: 1, unit: 'cup (150g)',
    search_keywords: ['aloo','potato curry','potato sabzi'],
    verified: true, use_count: 28
  },
  {
    name: 'Palak Paneer',
    category: 'vegetables',
    calories: 280, protein: 14, carbs: 10, fats: 21, fiber: 3,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['spinach paneer','palak','saag paneer'],
    verified: true, use_count: 32
  },
  {
    name: 'Bhindi (Okra, Cooked)',
    category: 'vegetables',
    calories: 80, protein: 2, carbs: 9, fats: 4, fiber: 3,
    serving_size: 1, unit: 'cup (100g)',
    search_keywords: ['ladyfinger','okra','bhindi sabzi'],
    verified: true, use_count: 18
  },
  {
    name: 'Gobhi Sabzi (Cauliflower)',
    category: 'vegetables',
    calories: 90, protein: 2.5, carbs: 8, fats: 5, fiber: 2.5,
    serving_size: 1, unit: 'cup (100g)',
    search_keywords: ['cauliflower','gobi','phool gobi'],
    verified: true, use_count: 16
  },
  {
    name: 'Broccoli (Cooked)',
    category: 'vegetables',
    calories: 55, protein: 3.7, carbs: 11, fats: 0.6, fiber: 5,
    serving_size: 1, unit: 'cup (91g)',
    search_keywords: ['broccoli','green broccoli'],
    verified: true, use_count: 25
  },
  {
    name: 'Spinach (Raw)',
    category: 'vegetables',
    calories: 23, protein: 2.9, carbs: 3.6, fats: 0.4, fiber: 2.2,
    serving_size: 1, unit: 'cup (30g)',
    search_keywords: ['palak','spinach','saag'],
    verified: true, use_count: 22
  },
  {
    name: 'Tomato (Raw)',
    category: 'vegetables',
    calories: 22, protein: 1.1, carbs: 4.8, fats: 0.2, fiber: 1.5,
    serving_size: 1, unit: 'medium (100g)',
    search_keywords: ['tamatar','tomato','raw tomato'],
    verified: true, use_count: 18
  },
  {
    name: 'Onion (Raw)',
    category: 'vegetables',
    calories: 44, protein: 1.2, carbs: 10.3, fats: 0.1, fiber: 1.7,
    serving_size: 1, unit: 'medium (100g)',
    search_keywords: ['pyaz','onion','kanda'],
    verified: true, use_count: 15
  },
  {
    name: 'Cucumber (Raw)',
    category: 'vegetables',
    calories: 16, protein: 0.7, carbs: 3.6, fats: 0.1, fiber: 0.5,
    serving_size: 1, unit: 'medium (100g)',
    search_keywords: ['kheera','cucumber','salad'],
    verified: true, use_count: 14
  },
  {
    name: 'Peas (Green, Cooked)',
    category: 'vegetables',
    calories: 134, protein: 8.6, carbs: 25, fats: 0.4, fiber: 8.8,
    serving_size: 1, unit: 'cup (160g)',
    search_keywords: ['matar','green peas','sweet peas'],
    verified: true, use_count: 15
  },
  {
    name: 'Sweet Potato (Boiled)',
    category: 'vegetables',
    calories: 103, protein: 2.3, carbs: 23.6, fats: 0.1, fiber: 3.8,
    serving_size: 1, unit: 'medium (130g)',
    search_keywords: ['shakarkandi','sweet potato','shakkarkandi'],
    verified: true, use_count: 20
  },
  {
    name: 'Mixed Veg Curry',
    category: 'vegetables',
    calories: 150, protein: 4, carbs: 20, fats: 6, fiber: 4,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['sabzi','mix veg','mixed vegetable curry'],
    verified: true, use_count: 22
  },

  // ─── Fruits ──────────────────────────────────────────────────────────────
  {
    name: 'Banana',
    category: 'fruits',
    calories: 89, protein: 1.1, carbs: 23, fats: 0.3, fiber: 2.6,
    serving_size: 1, unit: 'medium (120g)',
    search_keywords: ['kela','banana','plantain'],
    verified: true, use_count: 45
  },
  {
    name: 'Apple',
    category: 'fruits',
    calories: 95, protein: 0.5, carbs: 25, fats: 0.3, fiber: 4.4,
    serving_size: 1, unit: 'medium (182g)',
    search_keywords: ['seb','apple'],
    verified: true, use_count: 35
  },
  {
    name: 'Mango (Alphonso)',
    category: 'fruits',
    calories: 99, protein: 1.4, carbs: 24.7, fats: 0.6, fiber: 2.6,
    serving_size: 1, unit: 'cup sliced (165g)',
    search_keywords: ['aam','mango','alphonso','kesar mango'],
    verified: true, use_count: 25
  },
  {
    name: 'Orange',
    category: 'fruits',
    calories: 62, protein: 1.2, carbs: 15.4, fats: 0.2, fiber: 3.1,
    serving_size: 1, unit: 'medium (130g)',
    search_keywords: ['santra','orange','narangi','citrus'],
    verified: true, use_count: 25
  },
  {
    name: 'Papaya',
    category: 'fruits',
    calories: 59, protein: 0.9, carbs: 15, fats: 0.1, fiber: 2.5,
    serving_size: 1, unit: 'cup (145g)',
    search_keywords: ['papita','papaya','raw papaya'],
    verified: true, use_count: 18
  },
  {
    name: 'Guava',
    category: 'fruits',
    calories: 68, protein: 2.6, carbs: 14.3, fats: 1, fiber: 5.4,
    serving_size: 1, unit: 'medium (100g)',
    search_keywords: ['amrood','guava'],
    verified: true, use_count: 16
  },
  {
    name: 'Watermelon',
    category: 'fruits',
    calories: 86, protein: 1.7, carbs: 21.6, fats: 0.4, fiber: 1.1,
    serving_size: 1, unit: '2 cups (280g)',
    search_keywords: ['tarbooz','watermelon','tarbuj'],
    verified: true, use_count: 15
  },
  {
    name: 'Grapes (Green/Black)',
    category: 'fruits',
    calories: 104, protein: 1.1, carbs: 27.3, fats: 0.2, fiber: 1.4,
    serving_size: 1, unit: 'cup (151g)',
    search_keywords: ['angoor','grapes','green grapes'],
    verified: true, use_count: 18
  },

  // ─── Snacks & Street Food ────────────────────────────────────────────────
  {
    name: 'Samosa (Fried)',
    category: 'snacks',
    calories: 262, protein: 4, carbs: 32, fats: 13, fiber: 2.5,
    serving_size: 1, unit: 'piece (100g)',
    search_keywords: ['samosa','fried samosa','street food'],
    verified: true, use_count: 20
  },
  {
    name: 'Kachori',
    category: 'snacks',
    calories: 280, protein: 5, carbs: 35, fats: 14, fiber: 2,
    serving_size: 1, unit: 'piece (80g)',
    search_keywords: ['kachori','raj kachori','dal kachori'],
    verified: true, use_count: 12
  },
  {
    name: 'Peanuts (Roasted)',
    category: 'snacks',
    calories: 166, protein: 7, carbs: 6, fats: 14, fiber: 2.4,
    serving_size: 1, unit: 'handful (30g)',
    search_keywords: ['mungfali','peanut','groundnut','moongfali'],
    verified: true, use_count: 25
  },
  {
    name: 'Makhana (Foxnuts, Roasted)',
    category: 'snacks',
    calories: 106, protein: 3.9, carbs: 19.9, fats: 0.4, fiber: 0,
    serving_size: 1, unit: 'cup (30g)',
    search_keywords: ['lotus seeds','phool makhana','fox nuts'],
    verified: true, use_count: 22
  },
  {
    name: 'Almonds',
    category: 'snacks',
    calories: 164, protein: 6, carbs: 6, fats: 14, fiber: 3.5,
    serving_size: 1, unit: 'handful (28g)',
    search_keywords: ['badam','almonds','nuts'],
    verified: true, use_count: 30
  },
  {
    name: 'Walnuts',
    category: 'snacks',
    calories: 185, protein: 4.3, carbs: 3.9, fats: 18.5, fiber: 1.9,
    serving_size: 1, unit: 'handful (28g)',
    search_keywords: ['akhrot','walnut','brain nut'],
    verified: true, use_count: 18
  },
  {
    name: 'Chivda (Low Oil)',
    category: 'snacks',
    calories: 180, protein: 4, carbs: 30, fats: 5, fiber: 2,
    serving_size: 1, unit: 'cup (50g)',
    search_keywords: ['poha chivda','namkeen','chivda','low fat snack'],
    verified: true, use_count: 12
  },

  // ─── Rice Dishes ─────────────────────────────────────────────────────────
  {
    name: 'Biryani (Chicken)',
    category: 'rice',
    calories: 290, protein: 18, carbs: 35, fats: 8, fiber: 1.5,
    serving_size: 1, unit: 'plate (250g)',
    search_keywords: ['chicken biryani','dum biryani','hyderabadi biryani'],
    verified: true, use_count: 38
  },
  {
    name: 'Biryani (Veg)',
    category: 'rice',
    calories: 220, protein: 5, carbs: 40, fats: 5, fiber: 2,
    serving_size: 1, unit: 'plate (250g)',
    search_keywords: ['veg biryani','vegetable biryani','pulao'],
    verified: true, use_count: 25
  },
  {
    name: 'Khichdi',
    category: 'rice',
    calories: 200, protein: 7, carbs: 35, fats: 3, fiber: 3,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['khichdi','dal chawal','moong khichdi'],
    verified: true, use_count: 20
  },
  {
    name: 'Fried Rice (Veg)',
    category: 'rice',
    calories: 254, protein: 5, carbs: 42, fats: 8, fiber: 2,
    serving_size: 1, unit: 'plate (200g)',
    search_keywords: ['fried rice','veg fried rice','chinese rice'],
    verified: true, use_count: 20
  },

  // ─── Curries & Gravies ───────────────────────────────────────────────────
  {
    name: 'Dal Makhani',
    category: 'pulses',
    calories: 220, protein: 11, carbs: 25, fats: 9, fiber: 7,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['dal makhni','black dal','mah di dal'],
    verified: true, use_count: 30
  },
  {
    name: 'Dal Fry',
    category: 'pulses',
    calories: 160, protein: 9, carbs: 22, fats: 4, fiber: 5,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['dal fry','tarka dal','tadka dal'],
    verified: true, use_count: 28
  },
  {
    name: 'Sambar',
    category: 'pulses',
    calories: 130, protein: 6, carbs: 20, fats: 3, fiber: 4,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['sambar','sambhar','south indian dal'],
    verified: true, use_count: 20
  },
  {
    name: 'Butter Chicken (Murgh Makhani)',
    category: 'meat',
    calories: 310, protein: 24, carbs: 10, fats: 20, fiber: 1,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['butter chicken','murgh makhani','tikka masala'],
    verified: true, use_count: 45
  },
  {
    name: 'Paneer Butter Masala',
    category: 'dairy',
    calories: 330, protein: 16, carbs: 15, fats: 25, fiber: 2,
    serving_size: 1, unit: 'cup (200g)',
    search_keywords: ['paneer butter masala','paneer makhani','cottage cheese curry'],
    verified: true, use_count: 38
  },

  // ─── Breakfast & Sweets ──────────────────────────────────────────────────
  {
    name: 'Peanut Butter',
    category: 'spreads',
    calories: 188, protein: 8, carbs: 6, fats: 16, fiber: 1.5,
    serving_size: 2, unit: 'tbsp (32g)',
    search_keywords: ['peanut butter','mungfali butter','nut butter'],
    verified: true, use_count: 35
  },
  {
    name: 'Chikki (Peanut Brittle)',
    category: 'sweets',
    calories: 160, protein: 4, carbs: 20, fats: 8, fiber: 1.5,
    serving_size: 1, unit: 'piece (40g)',
    search_keywords: ['chikki','peanut chikki','groundnut brittle','gajak'],
    verified: true, use_count: 12
  },
  {
    name: 'Halwa (Sooji/Rava)',
    category: 'sweets',
    calories: 320, protein: 4, carbs: 55, fats: 11, fiber: 1,
    serving_size: 1, unit: 'cup (150g)',
    search_keywords: ['suji halwa','semolina halwa','rava halwa','sheera'],
    verified: true, use_count: 12
  },
  {
    name: 'Lassi (Sweet)',
    category: 'beverages',
    calories: 180, protein: 5, carbs: 28, fats: 5, fiber: 0,
    serving_size: 1, unit: 'glass (300ml)',
    search_keywords: ['sweet lassi','mango lassi','punjabi lassi','yogurt drink'],
    verified: true, use_count: 18
  },
  {
    name: 'Chaas / Buttermilk',
    category: 'beverages',
    calories: 50, protein: 2.5, carbs: 4, fats: 2, fiber: 0,
    serving_size: 1, unit: 'glass (240ml)',
    search_keywords: ['chaas','buttermilk','mattha','masala chaas'],
    verified: true, use_count: 15
  },
  {
    name: 'Coconut Water',
    category: 'beverages',
    calories: 46, protein: 1.7, carbs: 8.9, fats: 0.5, fiber: 2.6,
    serving_size: 1, unit: 'cup (240ml)',
    search_keywords: ['nariyal pani','coconut water','tender coconut'],
    verified: true, use_count: 20
  },
  {
    name: 'Black Coffee',
    category: 'beverages',
    calories: 5, protein: 0.3, carbs: 0.7, fats: 0.1, fiber: 0,
    serving_size: 1, unit: 'cup (240ml)',
    search_keywords: ['black coffee','filter coffee','espresso','americano'],
    verified: true, use_count: 30
  },
  {
    name: 'Chai (Tea with Milk)',
    category: 'beverages',
    calories: 60, protein: 2, carbs: 8, fats: 2.5, fiber: 0,
    serving_size: 1, unit: 'cup (150ml)',
    search_keywords: ['chai','indian tea','milk tea','masala chai'],
    verified: true, use_count: 35
  },

  // ─── Fast Food & Restaurant ──────────────────────────────────────────────
  {
    name: 'Vada Pav',
    category: 'snacks',
    calories: 290, protein: 7, carbs: 40, fats: 12, fiber: 2,
    serving_size: 1, unit: 'piece (130g)',
    search_keywords: ['vada pav','batata vada pav','mumbai burger'],
    verified: true, use_count: 22
  },
  {
    name: 'Pav Bhaji',
    category: 'snacks',
    calories: 380, protein: 9, carbs: 55, fats: 14, fiber: 5,
    serving_size: 1, unit: 'plate (300g)',
    search_keywords: ['pav bhaji','mumbai street food','bhaji'],
    verified: true, use_count: 22
  },
  {
    name: 'Chole Bhature',
    category: 'snacks',
    calories: 480, protein: 14, carbs: 62, fats: 20, fiber: 8,
    serving_size: 1, unit: 'plate (300g)',
    search_keywords: ['chole bhature','puri chole','bhatura'],
    verified: true, use_count: 20
  },
  {
    name: 'Burger (Veg Patty)',
    category: 'snacks',
    calories: 300, protein: 8, carbs: 40, fats: 12, fiber: 2,
    serving_size: 1, unit: 'burger (150g)',
    search_keywords: ['veg burger','aloo tikki burger','mcaloo tikki'],
    verified: true, use_count: 18
  },
  {
    name: 'Pizza (Veg, 1 Slice)',
    category: 'snacks',
    calories: 237, protein: 9, carbs: 30, fats: 10, fiber: 1.5,
    serving_size: 1, unit: 'slice (100g)',
    search_keywords: ['pizza','cheese pizza','veg pizza','slice'],
    verified: true, use_count: 20
  },

  // ─── Protein Boosters ────────────────────────────────────────────────────
  {
    name: 'Tofu (Firm)',
    category: 'protein',
    calories: 144, protein: 15.5, carbs: 3.5, fats: 8.7, fiber: 0.3,
    serving_size: 100, unit: 'g',
    search_keywords: ['tofu','soya tofu','bean curd','soybean curd'],
    verified: true, use_count: 18
  },
  {
    name: 'Soya Chunks (Cooked)',
    category: 'protein',
    calories: 145, protein: 17, carbs: 9, fats: 3, fiber: 5,
    serving_size: 1, unit: 'cup (100g)',
    search_keywords: ['soya chunks','nutrela','meal maker','soy nuggets'],
    verified: true, use_count: 25
  },
  {
    name: 'Boiled Chana (Black Chickpeas)',
    category: 'pulses',
    calories: 208, protein: 11, carbs: 35, fats: 3.5, fiber: 8,
    serving_size: 1, unit: 'cup (180g)',
    search_keywords: ['kala chana','black chana','bengal gram','boiled chickpea'],
    verified: true, use_count: 22
  },
  {
    name: 'Lobia (Black Eyed Peas, Cooked)',
    category: 'pulses',
    calories: 198, protein: 13, carbs: 35, fats: 0.9, fiber: 11,
    serving_size: 1, unit: 'cup (170g)',
    search_keywords: ['lobia','cowpeas','black eyed beans','chawli'],
    verified: true, use_count: 12
  },
  {
    name: 'Cottage Cheese (Low Fat)',
    category: 'dairy',
    calories: 82, protein: 11, carbs: 3.4, fats: 2.3, fiber: 0,
    serving_size: 100, unit: 'g',
    search_keywords: ['low fat paneer','light paneer','diet paneer'],
    verified: true, use_count: 20
  },
  {
    name: 'Sattu (Roasted Gram Flour)',
    category: 'supplements',
    calories: 150, protein: 10, carbs: 22, fats: 2.5, fiber: 4,
    serving_size: 2, unit: 'tbsp (30g)',
    search_keywords: ['sattu','roasted gram flour','bihati sattu','sattu drink'],
    verified: true, use_count: 18
  },

  // ─── Condiments & Add-ons ────────────────────────────────────────────────
  {
    name: 'Olive Oil',
    category: 'fats',
    calories: 119, protein: 0, carbs: 0, fats: 13.5, fiber: 0,
    serving_size: 1, unit: 'tbsp (14g)',
    search_keywords: ['olive oil','cooking oil','extra virgin'],
    verified: true, use_count: 22
  },
  {
    name: 'Coconut Oil',
    category: 'fats',
    calories: 117, protein: 0, carbs: 0, fats: 13.6, fiber: 0,
    serving_size: 1, unit: 'tbsp (14g)',
    search_keywords: ['coconut oil','nariyal tel','copra oil'],
    verified: true, use_count: 15
  },
  {
    name: 'Honey',
    category: 'sweeteners',
    calories: 64, protein: 0.1, carbs: 17.3, fats: 0, fiber: 0,
    serving_size: 1, unit: 'tbsp (21g)',
    search_keywords: ['shahad','honey','natural sweetener'],
    verified: true, use_count: 20
  },
  {
    name: 'Jaggery (Gur)',
    category: 'sweeteners',
    calories: 66, protein: 0.1, carbs: 17, fats: 0.1, fiber: 0,
    serving_size: 1, unit: 'piece (20g)',
    search_keywords: ['gur','jaggery','gur ki chikki','palm sugar'],
    verified: true, use_count: 15
  },
];

async function seedFoods() {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    const existing = await Food.countDocuments();
    if (existing > 0) {
      console.log(`⚠️  Foods collection already has ${existing} documents.`);
      console.log('   To re-seed, drop the collection first: db.foods.drop()');
      process.exit(0);
    }

    const result = await Food.insertMany(foods);
    console.log(`✅ Seeded ${result.length} Indian foods successfully!`);

    // Create text indexes if not already there
    await Food.collection.createIndex(
      { name: 'text', search_keywords: 'text' },
      { weights: { name: 10, search_keywords: 5 } }
    );
    console.log('✅ Text index ensured');

  } catch (err) {
    console.error('❌ Seed error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

seedFoods();
