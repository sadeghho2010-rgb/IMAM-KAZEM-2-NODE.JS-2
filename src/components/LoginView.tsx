import React from 'react';
import LoginView from './auth/LoginView';

interface LoginViewProps {
  onLoginSuccess?: () => void;
}

export default function RootLoginView(props: LoginViewProps) {
  return <LoginView onLoginSuccess={props.onLoginSuccess} />;
}
