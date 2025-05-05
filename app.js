// SmartCommute App (React Native - With Settings Screen, Notifications, Alarms & Alternate Route Suggestions + Arrival Time Feature)

import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Alert, Platform, TextInput, ScrollView, Switch } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';

const GOOGLE_MAPS_API_KEY = 'YOUR_GOOGLE_MAPS_API_KEY';
const BACKGROUND_TASK = 'commute-background-task';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

TaskManager.defineTask(BACKGROUND_TASK, async () => {
  try {
    const commuteDuration = await fetchCommuteTime();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'SmartCommute Morning Check',
        body: `Your current commute is ${commuteDuration}`,
      },
      trigger: null,
    });
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (e) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

async function registerBackgroundTask() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_TASK, {
    minimumInterval: 3600,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

async function fetchCommuteTime(home, work) {
  const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(home)}&destination=${encodeURIComponent(work)}&departure_time=now&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  const mainRoute = data.routes[0];
  return {
    text: mainRoute.legs[0].duration_in_traffic.text,
    value: mainRoute.legs[0].duration_in_traffic.value
  };
}

export default function App() {
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [commuteInfo, setCommuteInfo] = useState(null);
  const [alternateRoute, setAlternateRoute] = useState(null);
  const [homeAddress, setHomeAddress] = useState('123 Main St, YourCity, State');
  const [workAddress, setWorkAddress] = useState('456 Office Rd, YourCity, State');
  const [userPrepTime, setUserPrepTime] = useState('30');
  const [leewayTime, setLeewayTime] = useState('10');
  const [setAlarm, setSetAlarm] = useState(false);
  const [arrivalTime, setArrivalTime] = useState('08:30');
  const [weeklySchedule, setWeeklySchedule] = useState({
    Monday: true,
    Tuesday: true,
    Wednesday: true,
    Thursday: true,
    Friday: true,
    Saturday: false,
    Sunday: false,
  });

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);

      if (Platform.OS !== 'web') {
        await registerBackgroundTask();
      }
    })();
  }, []);

  const getCommuteTime = async () => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    if (!weeklySchedule[today]) {
      Alert.alert('Not scheduled for today', 'You are not commuting today per your schedule.');
      return;
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(homeAddress)}&destination=${encodeURIComponent(workAddress)}&departure_time=now&alternatives=true&key=${GOOGLE_MAPS_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      const routes = data.routes;
      const mainRoute = routes[0];
      const altRoute = routes.length > 1 ? routes[1] : null;

      const mainText = mainRoute.legs[0].duration_in_traffic.text;
      const mainValue = mainRoute.legs[0].duration_in_traffic.value; // seconds
      setCommuteInfo(mainText);

      if (altRoute) {
        const altText = altRoute.legs[0].duration_in_traffic.text;
        setAlternateRoute(altText);
      }

      const prepSeconds = parseInt(userPrepTime) * 60;
      const leewaySeconds = parseInt(leewayTime) * 60;
      const totalSecondsNeeded = mainValue + prepSeconds + leewaySeconds;

      const [arrivalHour, arrivalMinute] = arrivalTime.split(':').map(Number);
      const desiredArrival = new Date();
      desiredArrival.setHours(arrivalHour);
      desiredArrival.setMinutes(arrivalMinute);
      desiredArrival.setSeconds(0);

      const alarmTime = new Date(desiredArrival.getTime() - totalSecondsNeeded * 1000);
      const notifyBody = `Current commute: ${mainText}. Be ready to leave by ${alarmTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'SmartCommute Alert',
          body: notifyBody,
        },
        trigger: null,
      });

      if (setAlarm) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 Time to Leave!',
            body: `Leave now to stay on schedule. Commute: ${mainText}`,
            sound: true,
          },
          trigger: alarmTime,
        });
      }

    } catch (error) {
      Alert.alert('Error', 'Failed to fetch commute time');
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.header}>SmartCommute</Text>

      <Text style={styles.label}>Home Address:</Text>
      <TextInput
        style={styles.input}
        value={homeAddress}
        onChangeText={setHomeAddress}
        placeholder="Enter your home address"
      />

      <Text style={styles.label}>Work/School Address:</Text>
      <TextInput
        style={styles.input}
        value={workAddress}
        onChangeText={setWorkAddress}
        placeholder="Enter your work address"
      />

      <Text style={styles.label}>Prep Time (min):</Text>
      <TextInput
        style={styles.input}
        value={userPrepTime}
        onChangeText={setUserPrepTime}
        keyboardType="numeric"
        placeholder="Time to get ready"
      />

      <Text style={styles.label}>Leeway Time (min):</Text>
      <TextInput
        style={styles.input}
        value={leewayTime}
        onChangeText={setLeewayTime}
        keyboardType="numeric"
        placeholder="Extra buffer time"
      />

      <Text style={styles.label}>Desired Arrival Time (HH:MM):</Text>
      <TextInput
        style={styles.input}
        value={arrivalTime}
        onChangeText={setArrivalTime}
        placeholder="e.g., 08:30"
      />

      <View style={styles.switchRow}>
        <Text style={styles.label}>Set alarm based on real-time commute?</Text>
        <Switch value={setAlarm} onValueChange={setSetAlarm} />
      </View>

      <Text style={styles.label}>Weekly Commute Schedule:</Text>
      {Object.keys(weeklySchedule).map((day) => (
        <View key={day} style={styles.switchRow}>
          <Text>{day}</Text>
          <Switch
            value={weeklySchedule[day]}
            onValueChange={(value) => setWeeklySchedule((prev) => ({ ...prev, [day]: value }))}
          />
        </View>
      ))}

      <Button title="Check Commute Time" onPress={getCommuteTime} />

      {commuteInfo && <Text style={styles.result}>Main route: {commuteInfo}</Text>}
      {alternateRoute && <Text style={styles.result}>Alternate route: {alternateRoute}</Text>}
      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    borderRadius: 8,
    width: '100%',
    marginBottom: 10,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginVertical: 5,
  },
  result: {
    marginTop: 20,
    fontSize: 18,
    color: 'green',
  },
  error: {
    marginTop: 20,
    fontSize: 16,
    color: 'red',
  },
});
