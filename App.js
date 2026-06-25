import React from 'react';
import { View, StatusBar } from 'react-native';
import SectionScreen from './src/screens/SectionScreen';
import { BASE_URL } from './src/constants/config';

const PRIMARY_COLOR = '#0D2B5E';

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <StatusBar barStyle="light-content" backgroundColor={PRIMARY_COLOR} />
      <SectionScreen url={BASE_URL} token="webview_mode" />
    </View>
  );
}
