import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import NotFound from "@/pages/not-found";
import Lobby from "@/pages/Lobby";
import Game from "@/pages/Game";
import AuthPage from "@/pages/AuthPage";
import StatsPage from "@/pages/StatsPage";
import SinglePlayerPage from "@/pages/SinglePlayerPage";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Lobby} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/stats" component={StatsPage} />
      <Route path="/single-player" component={SinglePlayerPage} />
      <Route path="/game/:id" component={Game} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
