
import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useGames } from '../context/GameContext';
import GameForm from '../components/GameForm';
import { Game, GameExtension, ScoreColumn } from '../types';

const EditExtension: React.FC = () => {
  const { gameId, extensionId } = useParams<{ gameId: string; extensionId: string }>();
  const navigate = useNavigate();
  const { getGameById, updateGame } = useGames();
  const game = getGameById(Number(gameId));
  
  const extension = game?.extensions?.find(ext => ext.id === extensionId);

  useEffect(() => {
    if (!game || !extension) {
        navigate('/');
    }
  }, [game, extension, navigate]);

  const handleSave = (
      _gameData: Partial<Game>, 
      extensionData?: { parentId: number, title: string, image: string, rating?: number, customColumns?: ScoreColumn[] }
  ) => {
    if (!game || !extension || !extensionData) return;

    // Create updated extension object
    const updatedExtension: GameExtension = {
        ...extension,
        title: extensionData.title,
        image: extensionData.image,
        rating: extensionData.rating, // Added this line to ensure rating is saved
        customColumns: extensionData.customColumns
    };

    // Update parent game's extension list
    const updatedExtensionsList = game.extensions?.map(ext => 
        ext.id === extension.id ? updatedExtension : ext
    ) || [];

    const updatedGame = {
        ...game,
        extensions: updatedExtensionsList
    };

    updateGame(updatedGame);
    navigate(`/game-details/${game.id}`);
  };

  if (!game || !extension) return null;

  // Prepare initial data for the form wrapper
  // We pass specific extension data
  const initialExtensionData = {
      ...extension,
      parentId: game.id
  };

  return (
    <GameForm 
        initialExtensionData={initialExtensionData}
        pageTitle="Uitbreiding Bewerken" 
        buttonLabel="Opslaan" 
        onSubmit={handleSave} 
        onCancel={() => navigate(-1)} 
        availableGames={[game]} // Only this game is relevant
    />
  );
};

export default EditExtension;
