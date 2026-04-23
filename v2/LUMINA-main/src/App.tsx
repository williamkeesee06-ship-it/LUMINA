import { LuminaProvider } from './store/LuminaContext';
import { LuminaLayout } from './components/layout/LuminaLayout';
import { useLuminaInitialization } from './hooks/useLuminaInitialization';

export default function App() {
  const { login } = useLuminaInitialization();


  return (
    <LuminaProvider login={login}>
      <LuminaLayout />
    </LuminaProvider>
  );

}
