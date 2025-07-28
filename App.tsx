/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState } from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  TextInput,
  Button,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';

const Tab = createBottomTabNavigator();

const PaymentFormScreen = () => {
  const [toUpi, setToUpi] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');

  const handlePayment = () => {
    if (!toUpi || !amount) {
      Alert.alert('Error', 'Please enter UPI ID and amount.');
      return;
    }

    const uri = `upi://pay?pa=${toUpi}&pn=Recipient&tn=${desc}&am=${amount}&cu=INR`;

    Linking.canOpenURL(uri)
      .then(supported => {
        if (!supported) {
          Alert.alert('Error', 'No UPI apps found. Install one to proceed.');
        } else {
          return Linking.openURL(uri);
        }
      })
      .catch(err => Alert.alert('Error', err.message));
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>UPI Payment</Text>
      
      <Text style={styles.label}>To UPI ID</Text>
      <TextInput
        placeholder="Enter UPI ID"
        value={toUpi}
        onChangeText={setToUpi}
        style={styles.input}
      />
      
      <Text style={styles.label}>Description</Text>
      <TextInput
        placeholder="Enter payment description"
        value={desc}
        onChangeText={setDesc}
        style={styles.input}
      />
      
      <Text style={styles.label}>Amount (INR)</Text>
      <TextInput
        placeholder="Enter amount"
        value={amount}
        onChangeText={setAmount}
        keyboardType="numeric"
        style={styles.input}
      />
      <Button title="Send" onPress={handlePayment} />
    </View>
  );
};

const ScanScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Scanner</Text>
      <Text style={styles.scanText}>Scan QR code to make payment</Text>
      <Button 
        title="Open Camera" 
        onPress={() => Alert.alert('Info', 'Camera functionality will be implemented here')}
      />
    </View>
  );
};

const App = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#ccc',
            paddingVertical: 5,
          },
          tabBarLabelStyle: {
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 5,
          },
          tabBarIconStyle: {
            display: 'none',
          },
          tabBarActiveTintColor: '#ffffff',
          tabBarInactiveTintColor: '#000000',
          tabBarActiveBackgroundColor: '#000000',
          tabBarInactiveBackgroundColor: 'transparent',
          tabBarItemStyle: {
            borderWidth: 2,
            borderColor: '#000000',
            borderRadius: 5,
            marginHorizontal: 10,
          },
        }}
      >
        <Tab.Screen 
          name="Form" 
          component={PaymentFormScreen}
          options={{
            tabBarLabel: 'Form',
          }}
        />
        <Tab.Screen 
          name="Scan" 
          component={ScanScreen}
          options={{
            tabBarLabel: 'Scan',
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    padding: 20,
  },
  input: {
    borderColor: '#ccc',
    borderWidth: 1,
    padding: 10,
    marginBottom: 15,
    borderRadius: 5,
    backgroundColor: '#fff',
    color: '#333',
    width: '80%',
  },
  title: {
    fontSize: 24,
    marginBottom: 30,
    textAlign: 'center',
    color: '#ffffff',
    fontWeight: 'bold',
  },
  label: {
    fontSize: 16,
    color: '#ffffff',
    marginBottom: 5,
    width: '80%',
    textAlign: 'left',
    fontWeight: '500',
  },
  scanText: {
    fontSize: 18,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 30,
  },
});

export default App;