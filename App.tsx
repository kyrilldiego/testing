
import React, { useEffect } from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { GameProvider, useGames } from './context/GameContext';
import GamesOverview from './screens/GamesOverview';
import NewRound from './screens/NewRound';
import Profile from './screens/Profile';
import Statistics from './screens/Statistics';
import Players from './screens/Players';
import Matches from './screens/Matches';
import GameDetails from './screens/GameDetails';
import MatchDetails from './screens/MatchDetails';
import AddNewGame from './screens/AddNewGame';
import EditGame from './screens/EditGame';
import EditMatch from './screens/EditMatch';
import EditExtension from './screens/EditExtension';
import Settings from './screens/Settings';
import AddPlayer from './screens/AddPlayer';
import ImportMatches from './screens/ImportMatches';
import Login from './screens/Login';

const { HashRouter, Routes, Route, useLocation, useNavigate } = ReactRouterDOM as any;

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useGames();

  useEffect(() => {
    // If authenticated, ensure we don't get stuck on login logic (handled by conditional render below)
    // But if we reload on a deep link, we want to stay there if auth is restored
    if (!isAuthenticated && location.pathname !== '/') {
       // Optionally redirect to root, but the conditional render handles protection
    }
  }, [isAuthenticated, location]);

  if (!isAuthenticated) {
      return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<GamesOverview />} />
      <Route path="/new-round" element={<NewRound />} />
      <Route path="/profile/:id?" element={<Profile />} />
      <Route path="/statistics" element={<Statistics />} />
      <Route path="/players" element={<Players />} />
      <Route path="/matches" element={<Matches />} />
      <Route path="/add-player" element={<AddPlayer />} />
      <Route path="/game-details/:id" element={<GameDetails />} />
      <Route path="/match-details/:id" element={<MatchDetails />} />
      <Route path="/edit-match/:id" element={<EditMatch />} />
      <Route path="/add-game" element={<AddNewGame />} />
      <Route path="/edit-game/:id" element={<EditGame />} />
      <Route path="/edit-extension/:gameId/:extensionId" element={<EditExtension />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/import" element={<ImportMatches />} />
    </Routes>
  );
};

const App: React.FC = () => {
  useEffect(() => {
    // Attempt to force Portrait mode on supported devices
    const lockOrientation = async () => {
      try {
        if (screen.orientation && 'lock' in screen.orientation) {
          // @ts-ignore - 'lock' is part of the standard Screen Orientation API
          await screen.orientation.lock('portrait');
        }
      } catch (e) {
        // Locking orientation usually fails if the app is not in fullscreen mode.
        // We fail silently as this is an enhancement, not a critical failure.
      }
    };
    lockOrientation();
  }, []);

  return (
    <GameProvider>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </GameProvider>
  );
};

export default App;
