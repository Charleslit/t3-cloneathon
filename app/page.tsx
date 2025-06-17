"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Sparkles,
  Brain,
  Zap,
  Shield,
  Blocks,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/chat");
    }
  }, [status, router]);

  if (status === "loading") return null;
  if (status === "authenticated") return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-24 relative">
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-blue-500/20 blur-3xl opacity-30" />
            <div className="absolute bottom-0 left-1/2 w-1/2 h-1/2 bg-gradient-to-r from-violet-500/30 to-purple-500/30 blur-3xl opacity-20 transform -translate-x-1/2" />
          </div>

          <div className="inline-flex items-center gap-2 bg-foreground/5 text-foreground/70 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Experience Next-Gen AI Chat
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-foreground mb-6 tracking-tight">
            Your AI Assistant
            <span className="bg-gradient-to-r from-purple-400 to-violet-400 bg-clip-text text-transparent block mt-2">
              Reimagined
            </span>
          </h1>

          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Dive into intelligent conversations powered by cutting-edge AI.
            Experience seamless communication that adapts to your needs.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/chat">
              <Button size="lg" className="rounded-full px-8 gap-2 group">
                Start Chatting{" "}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/register">
              <Button size="lg" variant="outline" className="rounded-full px-8">
                Sign Up Free
              </Button>
            </Link>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-20">
          <div className="group hover:bg-foreground/5 p-6 rounded-2xl transition-colors">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-purple-500/10 text-purple-500">
                <Brain className="w-8 h-8" />
              </div>
              <h3 className="text-foreground text-xl font-medium mb-2">
                Smart Conversations
              </h3>
              <p className="text-muted-foreground">
                Advanced AI that understands context and provides intelligent
                responses
              </p>
            </div>
          </div>

          <div className="group hover:bg-foreground/5 p-6 rounded-2xl transition-colors">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-blue-500/10 text-blue-500">
                <Zap className="w-8 h-8" />
              </div>
              <h3 className="text-foreground text-xl font-medium mb-2">
                Lightning Fast
              </h3>
              <p className="text-muted-foreground">
                Real-time responses with minimal latency for seamless interactions
              </p>
            </div>
          </div>

          <div className="group hover:bg-foreground/5 p-6 rounded-2xl transition-colors">
            <div className="flex flex-col items-center text-center">
              <div className="mb-4 p-3 rounded-full bg-violet-500/10 text-violet-500">
                <Shield className="w-8 h-8" />
              </div>
              <h3 className="text-foreground text-xl font-medium mb-2">
                Secure & Private
              </h3>
              <p className="text-muted-foreground">
                End-to-end encryption and privacy-first design for your peace of
                mind
              </p>
            </div>
          </div>
        </div>

        {/* Demo Section */}
        <div className="relative rounded-3xl overflow-hidden border border-foreground/10 bg-foreground/5 backdrop-blur-sm mb-20">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10" />
          <div className="relative p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                  Experience AI Chat Like Never Before
                </h2>
                <p className="text-muted-foreground mb-6">
                  Whether you're brainstorming ideas, seeking assistance, or just
                  want an engaging conversation, our AI is here to help.
                </p>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2 bg-foreground/10 rounded-full px-4 py-2">
                    <Blocks className="w-4 h-4 text-purple-400" />
                    <span className="text-sm">Code Understanding</span>
                  </div>
                  <div className="flex items-center gap-2 bg-foreground/10 rounded-full px-4 py-2">
                    <MessageSquare className="w-4 h-4 text-blue-400" />
                    <span className="text-sm">Natural Conversations</span>
                  </div>
                </div>
              </div>
              <div className="relative aspect-video rounded-xl overflow-hidden border border-foreground/10">
                <Image
                  src="/placeholder.jpg"
                  alt="AI Chat Demo"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Ready to Start?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of users already experiencing the future of AI
            communication.
          </p>
          <Link href="/register">
            <Button size="lg" className="rounded-full px-8">
              Get Started Free
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
