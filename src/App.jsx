import { useState, useEffect } from 'react';
import Login from './components/Login';
import TeamLeadDashboard from './components/TeamLeadDashboard';

function App() {
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLogin = (loggedInUser) => {
    if (loggedInUser.role !== 'TEAMLEAD') {
      alert("This portal is only for Team Leads.");
      return;
    }
    setUser(loggedInUser);
    localStorage.setItem('user', JSON.stringify(loggedInUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
  };

  if (!user) {
    return <Login onLogin={handleLogin} roleName="Team Lead" />;
  }

  return <TeamLeadDashboard onLogout={handleLogout} user={user} />;
}

export default App;
