
import React from 'react';
import * as ReactRouterDOM from 'react-router-dom';
import { useGames } from '../context/GameContext';
import { Game } from '../types';
import GameForm from '../components/GameForm';

const { useNavigate, useLocation } = ReactRouterDOM as any;

const AddNewGame: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { addGame, updateGame, games } = useGames();

  // Retrieve state passed from navigation (e.g. from GameDetails)
  const { mode, parentId } = location.state as { mode?: 'game' | 'extension', parentId?: number } || {};

  const handleValidation = (title: string) => {
      // Simple validation, can be expanded based on context
      return null;
  };

  const handleSave = (data: Partial<Game>, extensionData?: { parentId: number, title: string, image: string }) => {
    
    // Scenario 1: Adding a New Extension
    if (extensionData) {
        const parentGame = games.find(g => g.id === extensionData.parentId);
        if (parentGame) {
            const newExtension = {
                id: `ext_${Date.now()}`,
                title: extensionData.title,
                image: extensionData.image,
                customColumns: (extensionData as any).customColumns
            };
            
            const updatedGame = {
                ...parentGame,
                extensions: [...(parentGame.extensions || []), newExtension]
            };
            
            updateGame(updatedGame);
            navigate(`/game-details/${parentGame.id}`);
        }
        return;
    }

    // Scenario 2: Adding a New Game
    const exists = games.some(g => g.title.toLowerCase() === (data.title || '').trim().toLowerCase());
    if (exists) {
        // Fallback validation if GameForm didn't catch it (though it likely will via customValidation)
        alert("Dit spel bestaat al.");
        return;
    }

    const newGame: Game = {
      id: Date.now(),
      title: data.title || 'Nieuw Spel',
      lastPlayed: 'Nog nooit',
      playCount: 0,
      winner: { name: '-', score: '-' },
      image: data.image || '',
      type: data.type || 'score',
      description: data.description,
      // Ensure all configuration fields are saved
      inputMethod: data.inputMethod,
      winningCondition: data.winningCondition,
      scoreType: data.scoreType,
      customColumns: data.customColumns,
      isFavorite: false
    };

    addGame(newGame);
    navigate('/');
  };

  return (
    <GameForm 
      pageTitle="Nieuw Item Toevoegen" 
      buttonLabel="Opslaan" 
      onSubmit={handleSave} 
      onCancel={() => navigate(-1)} 
      customValidation={handleValidation}
      availableGames={games} // Pass games for the extension selector
      initialEntryType={mode}
      preSelectedParentId={parentId}
    />
  );
};

export default AddNewGame;
