/**
 * Authentication & Persona Context for DiabeTwin Platform.
 * Supports Patient, Clinician, and Admin roles with instant demo credential switching.
 * Swinburne University of Technology Sarawak · Ts. Dr. Vong Wan Tze
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, UserRole } from '../types';
import { DEMO_USERS, MOCK_PATIENTS } from '../api/mockData';

interface AuthContextType {
  currentUser: User | null;
  isAuthenticated: boolean;
  login: (role: UserRole, identifier: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  loginAsDemo: (demoKey: keyof typeof DEMO_USERS) => void;
  switchRole: (newRole: UserRole) => void;
  logout: () => void;
}

const STORAGE_KEY = 'diabetwin_auth_user';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed reading auth state from localStorage:', e);
    }
    // Default to Patient #1001 (Chen Wei) for immediate rich exploration
    return DEMO_USERS.patient_1001;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [currentUser]);

  const login = async (role: UserRole, identifier: string, _password?: string) => {
    // Realistic validation simulation
    const trimmed = identifier.trim().toLowerCase();

    if (role === 'patient') {
      // Find patient matching ID or email
      const matchedPatient = MOCK_PATIENTS.find(
        (p) => p.id === trimmed || p.name.toLowerCase().includes(trimmed)
      );

      if (matchedPatient) {
        const user: User = {
          id: `usr_${matchedPatient.id}`,
          name: matchedPatient.name,
          email: `${matchedPatient.name.toLowerCase().replace(/\s+/g, '.')}@patient.health`,
          role: 'patient',
          patientId: matchedPatient.id,
          title: `Patient #${matchedPatient.id} (Cohort)`,
          avatar:
            matchedPatient.gender === 'Female'
              ? 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80'
              : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
          department: 'Outpatient Endocrinology',
        };
        setCurrentUser(user);
        return { success: true };
      }

      // Fallback patient user
      setCurrentUser({
        id: 'usr_guest_patient',
        name: identifier || 'Chen Wei',
        email: identifier.includes('@') ? identifier : 'chen.wei@patient.health',
        role: 'patient',
        patientId: '1001',
        title: 'Patient #1001 (Cohort)',
        avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
        department: 'Outpatient Endocrinology',
      });
      return { success: true };
    } else {
      // Clinician / Admin
      setCurrentUser({
        id: 'admin_wong',
        name: identifier.includes('dr') ? identifier : 'Dr. Alex Wong',
        email: identifier.includes('@') ? identifier : 'dr.wong@swinburne.edu.my',
        role: 'admin',
        title: 'Chief Endocrinologist & Platform Admin',
        avatar: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=150&auto=format&fit=crop&q=80',
        department: 'Metabolic & Digital Health Lab',
      });
      return { success: true };
    }
  };

  const loginAsDemo = (demoKey: keyof typeof DEMO_USERS) => {
    if (DEMO_USERS[demoKey]) {
      setCurrentUser(DEMO_USERS[demoKey]);
    }
  };

  const switchRole = (newRole: UserRole) => {
    if (newRole === 'patient') {
      setCurrentUser(DEMO_USERS.patient_1001);
    } else {
      setCurrentUser(DEMO_USERS.admin_clinician);
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthenticated: !!currentUser,
        login,
        loginAsDemo,
        switchRole,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
