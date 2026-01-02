// components/SmartText.jsx
import React from "react";
import { Text } from "react-native";
import { useLanguage } from "../contexts/LanguageContext";

function SmartText(props) {
  const { children, style, ...otherProps } = props;
  
  // Get translation context with fallback
  let translate = (text) => text;
  let isRTL = false;
  
  try {
    const context = useLanguage();
    if (context && context.t) {
      translate = context.t;
      isRTL = context.isRTL || false;
    }
  } catch (err) {
    // Fallback if context not available
    console.warn("SmartText: Language context not available");
  }

  // Translate text content
  const getTranslatedText = (content) => {
    if (typeof content === "string") {
      return translate(content);
    }
    if (Array.isArray(content)) {
      return content.map((item) => getTranslatedText(item));
    }
    return content;
  };

  const translatedChildren = getTranslatedText(children);
  
  // Apply RTL styles if needed
  const rtlStyle = isRTL ? { textAlign: "right", writingDirection: "rtl" } : {};
  const combinedStyle = [style, rtlStyle];

  return (
    <Text {...otherProps} style={combinedStyle}>
      {translatedChildren}
    </Text>
  );
}

export default SmartText;