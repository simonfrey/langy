import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./hooks/useAuth";
import { useHasDecksWithCards } from "./hooks/useDecks";
import { useSync } from "./hooks/useSync";
import BottomNav from "./components/BottomNav";
import Login from "./pages/Login";
import DeckList from "./pages/DeckList";
import CreateDeck from "./pages/CreateDeck";
import EditCards from "./pages/EditCards";
import AddCard from "./pages/AddCard";
import Review from "./pages/Review";
import Generate from "./pages/Generate";
import Exercises from "./pages/Exercises";
import { BlobBackground } from "./components/Blobs";

function DefaultRoute() {
  const hasDecksWithCards = useHasDecksWithCards();
  if (hasDecksWithCards) {
    return <Navigate to="/review" replace />;
  }
  return <DeckList />;
}

function AuthenticatedLayout() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();
  useSync();

  if (loading) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-coral border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-cream">
      <BlobBackground key={pathname} />
      <div className="max-w-[700px] mx-auto">
        <Routes>
          <Route path="/" element={<DefaultRoute />} />
          <Route path="/decks" element={<DeckList />} />
          <Route path="/decks/new" element={<CreateDeck />} />
          <Route path="/decks/:deckId/edit" element={<EditCards />} />
          <Route path="/decks/:deckId/add-card" element={<AddCard />} />
          <Route path="/review" element={<Review />} />
          <Route path="/review/:deckId" element={<Review />} />
          <Route path="/exercises" element={<Exercises />} />
          <Route path="/generate" element={<Generate />} />
        </Routes>
      </div>
      <BottomNav />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route
        path="/login"
        element={
          <>
            <BlobBackground />
            <Login />
          </>
        }
      />
      <Route path="/*" element={<AuthenticatedLayout />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
