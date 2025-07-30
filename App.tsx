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
  TouchableOpacity,
  FlatList,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useCodeScanner,
} from 'react-native-vision-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';

const Tab = createBottomTabNavigator();

// Transaction interface
interface Transaction {
  id: string;
  date: string;
  time: string;
  toUpi: string;
  payeeName: string;
  amount: string;
  description: string;
  status: 'initiated' | 'completed' | 'failed' | 'binned';
  binnedDate?: string; // Date when moved to bin
}

// Storage functions
const STORAGE_KEY = 'upi_transactions';

const saveTransaction = async (transaction: Omit<Transaction, 'id' | 'date' | 'time' | 'status'>) => {
  try {
    const existingTransactions = await getTransactions();
    const newTransaction: Transaction = {
      ...transaction,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString('en-IN'),
      time: new Date().toLocaleTimeString('en-IN'),
      status: 'initiated',
    };
    
    const updatedTransactions = [newTransaction, ...existingTransactions];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedTransactions));
    return newTransaction;
  } catch (error) {
    console.error('Error saving transaction:', error);
    return null;
  }
};

const getTransactions = async (): Promise<Transaction[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error getting transactions:', error);
    return [];
  }
};

const updateTransactionStatus = async (id: string, status: 'initiated' | 'completed' | 'failed' | 'binned') => {
  try {
    const transactions = await getTransactions();
    const updated = transactions.map(t => {
      if (t.id === id) {
        if (status === 'failed') {
          // Move failed transactions to bin automatically
          return { 
            ...t, 
            status: 'binned' as const, 
            binnedDate: new Date().toISOString() 
          };
        }
        return { ...t, status };
      }
      return t;
    });
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Error updating transaction status:', error);
    return false;
  }
};

const deleteTransaction = async (id: string) => {
  try {
    const transactions = await getTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }
};

const clearAllTransactions = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error clearing transactions:', error);
    return false;
  }
};

// Clean up binned transactions older than 30 days
const cleanupOldBinnedTransactions = async () => {
  try {
    const transactions = await getTransactions();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const filtered = transactions.filter(t => {
      if (t.status === 'binned' && t.binnedDate) {
        const binnedDate = new Date(t.binnedDate);
        return binnedDate > thirtyDaysAgo;
      }
      return true;
    });
    
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return transactions.length - filtered.length; // Return number of deleted items
  } catch (error) {
    console.error('Error cleaning up old binned transactions:', error);
    return 0;
  }
};

// Restore transaction from bin
const restoreFromBin = async (id: string) => {
  try {
    const transactions = await getTransactions();
    const updated = transactions.map(t => 
      t.id === id ? { ...t, status: 'initiated' as const, binnedDate: undefined } : t
    );
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    console.error('Error restoring transaction from bin:', error);
    return false;
  }
};

// Permanently delete binned transaction
const permanentlyDelete = async (id: string) => {
  try {
    const transactions = await getTransactions();
    const filtered = transactions.filter(t => t.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (error) {
    console.error('Error permanently deleting transaction:', error);
    return false;
  }
};

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

  const handlePayment = async () => {
    console.log('Initiating payment with UPI ID:', toUpi);
    if (!toUpi || !amount) {
      Alert.alert('Error', 'Please enter UPI ID and amount.');
      return;
    }

    // Save transaction before initiating payment
    const transaction = await saveTransaction({
      toUpi,
      payeeName,
      amount,
      description: desc,
    });

    if (transaction) {
      Alert.alert(
        'Transaction Saved',
        'Transaction has been recorded in your history.',
        [{ text: 'OK' }]
      );
    }

    const uri = `upi://pay?pa=${toUpi}&pn=${payeeName || 'Recipient'}&tn=${desc}&am=${amount}&cu=INR`;

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

const TransactionsScreen = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'bin'>('pending');

  useEffect(() => {
    loadTransactions();
    // Clean up old binned transactions on component mount
    cleanupOldBinnedTransactions();
  }, []);

  const loadTransactions = async () => {
    setLoading(true);
    const data = await getTransactions();
    setTransactions(data);
    setLoading(false);
  };

  const handleStatusChange = async (id: string, newStatus: 'completed' | 'failed') => {
    const success = await updateTransactionStatus(id, newStatus);
    if (success) {
      loadTransactions();
      if (newStatus === 'failed') {
        Alert.alert('Transaction Failed', 'Transaction has been moved to bin and will be automatically deleted after 30 days.');
      } else {
        Alert.alert('Success', `Transaction marked as ${newStatus}`);
      }
    } else {
      Alert.alert('Error', 'Failed to update transaction status');
    }
  };

  const handleRestore = async (id: string) => {
    const success = await restoreFromBin(id);
    if (success) {
      loadTransactions();
      Alert.alert('Success', 'Transaction restored from bin');
    } else {
      Alert.alert('Error', 'Failed to restore transaction');
    }
  };

  const handlePermanentDelete = async (id: string) => {
    Alert.alert(
      'Permanent Delete',
      'Are you sure you want to permanently delete this transaction? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            const success = await permanentlyDelete(id);
            if (success) {
              loadTransactions();
              Alert.alert('Success', 'Transaction permanently deleted');
            }
          },
        },
      ]
    );
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteTransaction(id);
            if (success) {
              loadTransactions();
            }
          },
        },
      ]
    );
  };

  const handleClearAll = async () => {
    Alert.alert(
      'Clear All Transactions',
      'Are you sure you want to delete all transactions? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            const success = await clearAllTransactions();
            if (success) {
              loadTransactions();
            }
          },
        },
      ]
    );
  };

  const handleCleanupOldBinned = async () => {
    Alert.alert(
      'Cleanup Old Binned Items',
      'This will permanently delete all binned transactions older than 30 days. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Cleanup',
          style: 'destructive',
          onPress: async () => {
            const deletedCount = await cleanupOldBinnedTransactions();
            loadTransactions();
            Alert.alert('Cleanup Complete', `${deletedCount} old transactions were permanently deleted.`);
          },
        },
      ]
    );
  };

  const exportToCSV = async () => {
    try {
      const filteredTransactions = getFilteredTransactions();
      if (filteredTransactions.length === 0) {
        Alert.alert('No Data', `No ${activeTab} transactions to export.`);
        return;
      }

      // Create CSV content
      const headers = ['Date', 'Time', 'UPI ID', 'Payee Name', 'Amount (INR)', 'Description', 'Status'];
      const csvContent = [
        headers.join(','),
        ...filteredTransactions.map(t =>
          [
            t.date,
            t.time,
            t.toUpi,
            t.payeeName || 'N/A',
            t.amount,
            t.description || 'N/A',
            t.status,
          ].join(',')
        ),
      ].join('\n');

      // Save to file
      const path = `${RNFS.DocumentDirectoryPath}/upi_${activeTab}_transactions_${Date.now()}.csv`;
      await RNFS.writeFile(path, csvContent, 'utf8');

      // Share the file
      await Share.open({
        url: `file://${path}`,
        type: 'text/csv',
        title: `UPI ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Transactions`,
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export transactions.');
    }
  };

  const exportToJSON = async () => {
    try {
      const filteredTransactions = getFilteredTransactions();
      if (filteredTransactions.length === 0) {
        Alert.alert('No Data', `No ${activeTab} transactions to export.`);
        return;
      }

      const jsonContent = JSON.stringify(filteredTransactions, null, 2);
      const path = `${RNFS.DocumentDirectoryPath}/upi_${activeTab}_transactions_${Date.now()}.json`;
      await RNFS.writeFile(path, jsonContent, 'utf8');

      await Share.open({
        url: `file://${path}`,
        type: 'application/json',
        title: `UPI ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Transactions`,
      });
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export transactions.');
    }
  };

  const getFilteredTransactions = () => {
    return transactions.filter(transaction => {
      if (activeTab === 'pending') {
        return transaction.status === 'initiated';
      } else if (activeTab === 'approved') {
        return transaction.status === 'completed';
      } else if (activeTab === 'bin') {
        return transaction.status === 'binned';
      }
      return false;
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'initiated': return '#ff9500';
        case 'completed': return '#34c759';
        case 'failed': return '#ff3b30';
        case 'binned': return '#8e8e93';
        default: return '#ff9500';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'initiated': return 'PENDING';
        case 'completed': return 'COMPLETED';
        case 'failed': return 'FAILED';
        case 'binned': return 'BINNED';
        default: return 'PENDING';
      }
    };

    const getDaysUntilDeletion = (binnedDate?: string) => {
      if (!binnedDate) return null;
      const binned = new Date(binnedDate);
      const now = new Date();
      const diffTime = 30 * 24 * 60 * 60 * 1000 - (now.getTime() - binned.getTime()); // 30 days in milliseconds
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    };

    return (
      <View style={styles.transactionCard}>
        <View style={styles.transactionHeader}>
          <Text style={styles.transactionDate}>{item.date} {item.time}</Text>
          <TouchableOpacity onPress={() => handleDelete(item.id)}>
            <Text style={styles.deleteButton}>🗑️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.transactionDetails}>
          <Text style={styles.transactionUPI}>To: {item.toUpi}</Text>
          {item.payeeName ? <Text style={styles.transactionPayee}>Name: {item.payeeName}</Text> : null}
          <Text style={styles.transactionAmount}>Amount: ₹{item.amount}</Text>
          {item.description ? <Text style={styles.transactionDesc}>Desc: {item.description}</Text> : null}
          <Text style={[styles.transactionStatus, { color: getStatusColor(item.status) }]}>
            Status: {getStatusText(item.status)}
          </Text>
          
          {/* Show days until permanent deletion for binned items */}
          {item.status === 'binned' && item.binnedDate && (
            <Text style={styles.binWarning}>
              Auto-delete in {getDaysUntilDeletion(item.binnedDate)} days
            </Text>
          )}
        </View>
        
        {/* Status change buttons for pending transactions */}
        {item.status === 'initiated' && (
          <View style={styles.statusButtonRow}>
            <TouchableOpacity 
              style={styles.statusButton}
              onPress={() => handleStatusChange(item.id, 'completed')}
            >
              <Text style={styles.statusButtonText}>Mark Completed</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusButton, styles.failedButton]}
              onPress={() => handleStatusChange(item.id, 'failed')}
            >
              <Text style={styles.statusButtonText}>Mark Failed</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Restore and permanent delete buttons for binned transactions */}
        {item.status === 'binned' && (
          <View style={styles.statusButtonRow}>
            <TouchableOpacity 
              style={styles.statusButton}
              onPress={() => handleRestore(item.id)}
            >
              <Text style={styles.statusButtonText}>Restore</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.statusButton, styles.failedButton]}
              onPress={() => handlePermanentDelete(item.id)}
            >
              <Text style={styles.statusButtonText}>Delete Forever</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Loading...</Text>
      </View>
    );
  }

  const filteredTransactions = getFilteredTransactions();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction History</Text>
      
      {/* Tab Buttons */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'pending' && styles.activeTabButton]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'pending' && styles.activeTabButtonText]}>
            Pending ({transactions.filter(t => t.status === 'initiated').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'approved' && styles.activeTabButton]}
          onPress={() => setActiveTab('approved')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'approved' && styles.activeTabButtonText]}>
            Approved ({transactions.filter(t => t.status === 'completed').length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabButton, activeTab === 'bin' && styles.activeTabButton]}
          onPress={() => setActiveTab('bin')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'bin' && styles.activeTabButtonText]}>
            Bin ({transactions.filter(t => t.status === 'binned').length})
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.exportButton} onPress={exportToCSV}>
          <Text style={styles.exportButtonText}>Export CSV</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.exportButton} onPress={exportToJSON}>
          <Text style={styles.exportButtonText}>Export JSON</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.refreshButton} onPress={loadTransactions}>
          <Text style={styles.refreshButtonText}>Refresh</Text>
        </TouchableOpacity>
        {activeTab === 'bin' ? (
          <TouchableOpacity style={styles.clearButton} onPress={handleCleanupOldBinned}>
            <Text style={styles.clearButtonText}>Cleanup Old</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
            <Text style={styles.clearButtonText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {filteredTransactions.length === 0 ? (
        <Text style={styles.emptyText}>No {activeTab} transactions found</Text>
      ) : (
        <FlatList
          data={filteredTransactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          style={styles.transactionsList}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const App = () => {
  useEffect(() => {
    // Clean up old binned transactions when app starts
    const initializeApp = async () => {
      const deletedCount = await cleanupOldBinnedTransactions();
      if (deletedCount > 0) {
        console.log(`Cleaned up ${deletedCount} old binned transactions`);
      }
    };
    
    initializeApp();
  }, []);

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
        <Tab.Screen
          name="History"
          component={TransactionsScreen}
          options={{
            tabBarLabel: 'History',
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
  // Transaction styles
  transactionsList: {
    flex: 1,
    width: '100%',
  },
  transactionCard: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 15,
    marginBottom: 10,
    marginHorizontal: 20,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  transactionDate: {
    fontSize: 12,
    color: '#cccccc',
  },
  deleteButton: {
    fontSize: 18,
    padding: 5,
  },
  transactionDetails: {
    gap: 5,
  },
  transactionUPI: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
  },
  transactionPayee: {
    fontSize: 14,
    color: '#ffffff',
  },
  transactionAmount: {
    fontSize: 16,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  transactionDesc: {
    fontSize: 14,
    color: '#cccccc',
  },
  transactionStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    marginBottom: 15,
    paddingHorizontal: 20,
  },
  exportButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  refreshButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  refreshButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  clearButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyText: {
    fontSize: 16,
    color: '#cccccc',
    textAlign: 'center',
    marginTop: 50,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 4,
    width: '90%',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTabButton: {
    backgroundColor: '#007AFF',
  },
  tabButtonText: {
    fontSize: 14,
    color: '#cccccc',
    fontWeight: '600',
  },
  activeTabButtonText: {
    color: '#ffffff',
  },
  // Status button styles
  statusButtonRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 10,
  },
  statusButton: {
    flex: 1,
    backgroundColor: '#34C759',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  failedButton: {
    backgroundColor: '#FF3B30',
  },
  statusButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  // Bin warning style
  binWarning: {
    fontSize: 11,
    color: '#ff9500',
    fontWeight: '500',
    fontStyle: 'italic',
  },
});

export default App;
