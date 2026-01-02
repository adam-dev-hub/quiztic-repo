import { ID, Databases } from "react-native-appwrite";
import { createContext, useContext, useEffect, useState } from "react";
import { account } from "../lib/appwrite";
import { client } from "../lib/appwrite";
import { showToast } from "../lib/toasthelper" // Keep toast import for other functions like register/logout

const UserContext = createContext();

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  async function login(email, password) {
    try {
      await account.createEmailPasswordSession(email, password);
      const currentUser = await account.get();
      setUser(currentUser);
      showToast("Welcome back!"); // This toast is fine, it's for success
      return currentUser;
    } catch (error) {
      // REMOVED: showToast(error.message);
      // We now just throw the error, allowing the calling component (Login.jsx)
      // to decide which toast message to show.
      throw error;
    }
  }

  async function logout() {
    try {
      await account.deleteSession("current");
      setUser(null);
      showToast("Logged out successfully");
    } catch (error) {
      showToast(error.message); // This toast can remain as it's for logout error handling
    }
  }

  async function register(email, password, name, cin, userType = "student") {
    try {
      await account.create(ID.unique(), email, password, name);
      await account.updatePrefs({
        cin,
        userType,
      });

      // Store student in database if it's a student
      if (userType === "student") {
        const databases = new Databases(client);
        const DATABASE_ID = "685ae2ba0012dcb2feda";
        const STUDENTS_COLLECTION_ID = "685aec0b0015ee8e5254";

        const nameParts = name.trim().split(" ");
        const stname = nameParts[0];
        const stfamilyname = nameParts.slice(1).join(" ") || "";

        await databases.createDocument(
          DATABASE_ID,
          STUDENTS_COLLECTION_ID,
          ID.unique(),
          {
            stmail: email,
            stpass: password, // ⚠️ Store safely in real apps!
            stcin: cin,
            stname,
            stfamilyname,
          }
        );
      }

      const currentUser = await account.get();
      setUser(currentUser);
      return currentUser;
    } catch (error) {
      showToast(error.message); // This toast can remain as it's for register error handling
      throw error;
    }
  }

  async function init() {
    try {
      const currentUser = await account.get();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    init();
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        register,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}