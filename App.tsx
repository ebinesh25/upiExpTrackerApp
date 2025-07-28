/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';

const App = () => {
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
});

export default App;