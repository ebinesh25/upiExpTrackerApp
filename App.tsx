/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  TextInput,
  Button,
  Linking,
  StyleSheet,
  Alert,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';

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
  const [showScanner, setShowScanner] = useState(false);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      if (codes.length > 0) {
        const qrData = codes[0].value;
        setShowScanner(false);
        
        // Check if it's a UPI QR code
        if (qrData && (qrData.includes('upi://pay') || qrData.includes('pa='))) {
          Alert.alert(
            'UPI QR Code Detected',
            'Opening payment app...',
            [
              {
                text: 'Cancel',
                onPress: () => {},
                style: 'cancel',
              },
              {
                text: 'Pay',
                onPress: () => {
                  Linking.openURL(qrData)
                    .then(() => {})
                    .catch(() => {
                      Alert.alert('Error', 'Could not open payment app');
                    });
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'QR Code Scanned',
            `Content: ${qrData}`,
            [
              {
                text: 'OK',
                onPress: () => {},
              },
            ]
          );
        }
      }
    }
  });

  const handleOpenCamera = async () => {
    if (!hasPermission) {
      const permission = await requestPermission();
      if (!permission) {
        Alert.alert('Permission Denied', 'Camera permission is required to scan QR codes.');
        return;
      }
    }
    
    if (!device) {
      Alert.alert('Error', 'No camera device found.');
      return;
    }
    
    setShowScanner(true);
  };

  if (showScanner) {
    return (
      <View style={styles.scanContainer}>
        <Camera
          style={styles.camera}
          device={device}
          isActive={true}
          codeScanner={codeScanner}
        />
        <View style={styles.scanOverlay}>
          <Button
            title="Cancel"
            onPress={() => setShowScanner(false)}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>QR Code Scanner</Text>
      <Text style={styles.scanText}>Scan QR code to make payment</Text>
      <Button title="Open Camera" onPress={handleOpenCamera} />
    </View>
  );
};

const App = () => {
  return (
    <NavigationContainer>
      <Tab.Navigator
        {...({} as any)}
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
  scanContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  scanOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  mockCameraView: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    paddingVertical: 50,
  },
  camera: {
    flex: 1,
  },
  scanFrame: {
    borderColor: '#ffffff',
    borderWidth: 2,
    borderRadius: 10,
    width: 250,
    height: 250,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  scanFrameText: {
    fontSize: 60,
    color: '#ffffff',
  },
  scanTitle: {
    fontSize: 24,
    color: '#ffffff',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  scanBottomContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  scanInstruction: {
    fontSize: 16,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 20,
  },
  buttonSpacing: {
    height: 10,
  },
  lastScanText: {
    fontSize: 14,
    color: '#cccccc',
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
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
