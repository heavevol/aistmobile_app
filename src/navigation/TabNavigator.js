import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import SectionScreen from '../screens/SectionScreen';
import { SECTIONS, TAB_BG, TAB_ACTIVE, TAB_INACTIVE } from '../constants/config';

const Tab = createBottomTabNavigator();

// Иконки для вкладок (эмодзи — не нужны сторонние библиотеки)
const ICONS = {
  Видеостена: { active: '📹', inactive: '🎥' },
  Метеостена: { active: '🌤',  inactive: '⛅' },
  Журнал:     { active: '📋', inactive: '📄' },
  Карта:      { active: '🗺',  inactive: '🗺'  },
};

function TabIcon({ name, focused }) {
  const icon = ICONS[name];
  return (
    <View style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22 }}>
        {focused ? icon.active : icon.inactive}
      </Text>
    </View>
  );
}

export default function TabNavigator({ token }) {
  const screenOptions = ({ route }) => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: TAB_BG,
      borderTopColor: 'rgba(74,158,255,0.2)',
      borderTopWidth: 1,
      height: 64,
      paddingBottom: 8,
      paddingTop: 6,
    },
    tabBarActiveTintColor: TAB_ACTIVE,
    tabBarInactiveTintColor: TAB_INACTIVE,
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    tabBarIcon: ({ focused }) => (
      <TabIcon name={route.name} focused={focused} />
    ),
  });

  return (
    <Tab.Navigator screenOptions={screenOptions}>

      <Tab.Screen name="Видеостена">
        {() => (
          <SectionScreen
            url={SECTIONS.videowall.url}
            title="Видеостена"
            token={token}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Метеостена">
        {() => (
          <SectionScreen
            url={SECTIONS.meteowall.url}
            title="Метеостена"
            token={token}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Журнал">
        {() => (
          <SectionScreen
            url={SECTIONS.journal.url}
            title="Журнал оперативного дежурного"
            token={token}
          />
        )}
      </Tab.Screen>

      <Tab.Screen name="Карта">
        {() => (
          <SectionScreen
            url={SECTIONS.map.url}
            title="Интерактивная карта"
            token={token}
          />
        )}
      </Tab.Screen>

    </Tab.Navigator>
  );
}
