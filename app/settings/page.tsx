"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from "@/components/ui/table";
import {
  Form,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormField,
} from "@/components/ui/form";
import { useToast } from "@/components/ui/use-toast";

interface ApiKey {
  provider: string;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const form = useForm<{ provider: string; apiKey: string }>();

  // Fetch API keys
  const fetchKeys = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys");
      const data = await res.json();
      if (data.success) {
        setKeys(data.data);
      } else {
        toast({ title: "Error", description: data.message || "Failed to fetch API keys", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to fetch API keys", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
    // eslint-disable-next-line
  }, []);

  // Add or update API key
  const onSubmit = async (values: { provider: string; apiKey: string }) => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Success", description: `API key for ${values.provider} saved.` });
        form.reset();
        fetchKeys();
      } else {
        toast({ title: "Error", description: data.message || "Failed to save API key", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to save API key", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Delete API key
  const handleDelete = async (provider: string) => {
    if (!window.confirm(`Delete API key for ${provider}?`)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Deleted", description: `API key for ${provider} deleted.` });
        fetchKeys();
      } else {
        toast({ title: "Error", description: data.message || "Failed to delete API key", variant: "destructive" });
      }
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete API key", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <h1 className="text-3xl font-bold mb-6">API Key Settings</h1>
      <div className="mb-10">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. openai, gemini" {...field} required disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="apiKey"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Key</FormLabel>
                  <FormControl>
                    <Input placeholder="Paste your API key" {...field} required disabled={loading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : "Save API Key"}
            </Button>
          </form>
        </Form>
      </div>
      <div>
        <h2 className="text-xl font-semibold mb-2">Your API Keys</h2>
        <Table>
          <TableCaption>Manage your saved API keys. Only the provider name and timestamps are shown for security.</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {keys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  No API keys saved.
                </TableCell>
              </TableRow>
            ) : (
              keys.map((key) => (
                <TableRow key={key.provider}>
                  <TableCell>{key.provider}</TableCell>
                  <TableCell>{new Date(key.createdAt).toLocaleString()}</TableCell>
                  <TableCell>{new Date(key.updatedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(key.provider)}
                      disabled={loading}
                    >
                      Delete
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 