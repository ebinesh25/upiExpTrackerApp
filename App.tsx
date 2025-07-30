/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useState, useEffect } from 'react';
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

// Function to parse UPI URL and extract details
const parseUpiUrl = (upiUrl: string) => {
  console.log('Raw UPI URL:', upiUrl);
  
  try {
    // Handle different UPI URL formats
    let url;
    if (upiUrl.startsWith('upi://pay')) {
      url = new URL(upiUrl);
    } else if (upiUrl.includes('upi://pay')) {
      // Extract the UPI part from a longer URL
      const upiMatch = upiUrl.match(/upi:\/\/pay[^&\s]*/);
      if (upiMatch) {
        url = new URL(upiMatch[0]);
      } else {
        throw new Error('Invalid UPI format');
      }
    } else {
      // Handle cases where it might be just the UPI ID or other formats
      return {
        pa: upiUrl.includes('@') ? upiUrl : '',
        pn: '',
        am: '',
        cu: 'INR',
        tn: '',
      };
    }
    
    const params = new URLSearchParams(url.search);
    
    const result = {
      pa: params.get('pa') || '', // payee address
      pn: params.get('pn') || '', // payee name
      am: params.get('am') || '', // amount
      cu: params.get('cu') || 'INR', // currency
      tn: params.get('tn') || '', // transaction note/description
    };
    
    console.log('Parsed UPI result:', result);
    return result;
    
  } catch (error) {
    console.error('Error parsing UPI URL:', error);
    // Fallback: try to extract UPI ID from the string
    const upiMatch = upiUrl.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+)/);
    return {
      pa: upiMatch ? upiMatch[1] : '',
      pn: '',
      am: '',
      cu: 'INR',
      tn: '',
    };
  }
};

const PaymentFormScreen = ({ route }: any) => {
  const scannedData = route?.params?.scannedData;
  
  const [toUpi, setToUpi] = useState('');
  const [desc, setDesc] = useState('');
  const [amount, setAmount] = useState('');
  const [payeeName, setPayeeName] = useState('');

  // Update form fields when scanned data changes
  useEffect(() => {
    if (scannedData) {
      const parsedUpi = parseUpiUrl(scannedData);
      console.log('Scanned Data:', scannedData);
      console.log('Parsed UPI Data:', parsedUpi);
      
      setToUpi(parsedUpi.pa || '');
      setDesc(parsedUpi.tn || '');
      setAmount(parsedUpi.am || '');
      setPayeeName(parsedUpi.pn || '');
      
      console.log('Updated state - toUpi:', parsedUpi.pa, 'amount:', parsedUpi.am);
    }
  }, [scannedData]);

  // Debug: Log current state values
  console.log('Current State - toUpi:', toUpi, 'amount:', amount, 'desc:', desc);

  const handlePayment = () => {
    console.log('Initiating payment with UPI ID:', toUpi);
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
      
      {payeeName ? (
        <View style={styles.payeeInfo}>
          <Text style={styles.payeeLabel}>Paying to:</Text>
          <Text style={styles.payeeName}>{payeeName}</Text>
        </View>
      ) : null}

      <Text style={styles.label}>To UPI ID</Text>
      <TextInput
        placeholder="Enter UPI ID"
        value={toUpi}
        onChangeText={setToUpi}
        style={styles.input}
        editable={!scannedData} // Make read-only if scanned
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
        editable={!amount || !scannedData} // Make read-only if amount is already set from scan
      />
      <Button title="Pay" onPress={handlePayment} />
    </View>
  );
};

const ScanScreen = ({ navigation }: any) => {
  const [showScanner, setShowScanner] = useState(false);
  const device = useCameraDevice('back');
  const { hasPermission, requestPermission } = useCameraPermission();

  const codeScanner = useCodeScanner({
    codeTypes: ['qr', 'ean-13'],
    onCodeScanned: (codes) => {
      console.log(`Scanned ${codes.length} codes!`);
      console.log(`Scanned ${JSON.stringify(codes, null, 2)} codes`);
      if (codes.length > 0) {
        const qrData = codes[0].value;
        setShowScanner(false);
        
        // Check if it's a UPI QR code
        if (qrData && (qrData.includes('upi://pay') || qrData.includes('pa='))) {
          // Navigate to Form tab with scanned data
          navigation.navigate('Form', { scannedData: qrData });
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
  payeeInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    width: '80%',
    alignItems: 'center',
  },
  payeeLabel: {
    fontSize: 14,
    color: '#cccccc',
    marginBottom: 5,
  },
  payeeName: {
    fontSize: 18,
    color: '#ffffff',
    fontWeight: 'bold',
  },
});

export default App;
