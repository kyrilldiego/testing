import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import GameForm from '../components/GameForm';
import { Game } from '../types';

const EditGame: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getGameById, updateGame, games } = useGames();
  const game = getGameById(Number(id));

  useEffect(() => {
    if (!game) {
        navigate('/');
    }
  }, [game, navigate]);

  const handleValidation = (title: string) => {
      if (!game) return null;
      // Check if duplicate title exists but exclude self
      const exists = games.some(g => g.id !== game.id && g.title.toLowerCase() === title.trim().toLowerCase());
      if (exists) return "Dit spel bestaat al. Kies een andere naam.";
      return null;
  };

  const handleSave = (formData: Partial<Game>) => {
    if (!game) return;

    // Merge new form data with existing game stats to preserve history
    const updatedGame: Game = {
      ...game, // Keep id, playCount, lastPlayed, winner, isFavorite
      ...formData, // Overwrite title, image, type, description, etc.
      type: formData.type || game.type, // Ensure type is correct
    };

    updateGame(updatedGame);
    navigate(-1);
  };

  if (!game) return null;

  return (
    <GameForm 
        initialData={game}
        pageTitle="Spel Bewerken" 
        buttonLabel="Wijzigingen Opslaan" 
        onSubmit={handleSave} 
        onCancel={() => navigate(-1)} 
        customValidation={handleValidation}
    />
  );
};

export default EditGame;