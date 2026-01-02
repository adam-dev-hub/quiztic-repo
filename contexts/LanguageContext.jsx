// contexts/LanguageContext.js
import React, { createContext, useContext, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, ActivityIndicator, Text } from "react-native";

// Import your translation files
import en from "../translations/en.json";
import fr from "../translations/fr.json";
import ar from "../translations/ar.json";
import jp from "../translations/jp.json";

const translations = {
  en,
  fr,
  ar,
  jp,
};

// Create context with default value
const LanguageContext = createContext({
  currentLanguage: "en",
  isRTL: false,
  changeLanguage: () => {},
  translate: (text) => text,
  t: (text) => text,
});

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState("en");
  const [isRTL, setIsRTL] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    loadLanguage();
  }, []);

  const loadLanguage = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem("appLanguage");
      const lang = savedLanguage && translations[savedLanguage] ? savedLanguage : "en";

      setCurrentLanguage(lang);
      setIsRTL(lang === "ar");
    } catch (error) {
      console.error("Error loading language:", error);
      setCurrentLanguage("en");
      setIsRTL(false);
    } finally {
      setIsReady(true);
    }
  };

  const changeLanguage = async (lang) => {
    try {
      if (!translations[lang]) {
        console.warn(`No translations found for language: ${lang}`);
        return;
      }

      setCurrentLanguage(lang);
      setIsRTL(lang === "ar");
      await AsyncStorage.setItem("appLanguage", lang);
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

  const translate = (text) => {
    if (!text || typeof text !== "string") {
      return text;
    }

    // Normalize spaces
    const cleanText = text.trim().replace(/\s+/g, " ");

    const langPack = translations[currentLanguage];
    if (!langPack) {
      return text;
    }

    const translation = langPack[cleanText];
    return translation || text;
  };

  const contextValue = {
    currentLanguage,
    isRTL,
    changeLanguage,
    translate,
    t: translate,
  };

  // Show loading indicator while initializing
  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6c5ce7' }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  
  if (!context) {
    console.warn("useLanguage must be used within LanguageProvider");
    // Return default fallback
    return {
      currentLanguage: "en",
      isRTL: false,
      changeLanguage: () => {},
      translate: (text) => text,
      t: (text) => text,
    };
  }
  
  return context;
}