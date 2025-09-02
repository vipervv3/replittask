import bcrypt from 'bcrypt';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  username: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  username?: string;
}

export class AuthService {
  async login(credentials: LoginRequest, storage: any): Promise<AuthUser | null> {
    try {
      const user = await storage.getUserByEmail(credentials.email);
      
      if (!user) {
        return null;
      }

      const isValid = await bcrypt.compare(credentials.password, user.password);
      if (!isValid) {
        return null;
      }

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username
      };
    } catch (error) {
      console.error('Login error:', error);
      return null;
    }
  }

  async register(userData: RegisterRequest, storage: any): Promise<AuthUser | null> {
    try {
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      
      if (existingUser) {
        throw new Error('User already exists with this email');
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(userData.password, saltRounds);

      // Create user
      const newUser = await storage.createUser({
        name: userData.name,
        email: userData.email,
        username: userData.username || userData.email.split('@')[0],
        password: hashedPassword,
        role: 'member'
      });

      // Create default user settings with notifications enabled
      try {
        await storage.createUserSettings({
          userId: newUser.id,
          emailNotifications: true,
          morningBriefing: true,
          taskDeadlineAlerts: true,
          endOfDaySummary: true,
          urgentOnly: false,
          workingHoursStart: '09:00',
          workingHoursEnd: '18:00'
        });
      } catch (error) {
        console.error('Failed to create default user settings:', error);
        // Continue with registration even if settings creation fails
      }

      return {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username
      };
    } catch (error) {
      console.error('Registration error:', error);
      return null;
    }
  }

  generateSessionToken(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}

export const authService = new AuthService();