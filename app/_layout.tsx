
import { Stack } from 'expo-router';

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}> 
      {/* headerShown: false هنا بتشيل الشريط الأبيض اللي فوق في كل الصفحات مرة واحدة */}
      <Stack.Screen name="index" />
      <Stack.Screen name="userType" /> 
      <Stack.Screen name="welcomeChild" />
      <Stack.Screen name="downloadFolders" />
    </Stack>
  );
}