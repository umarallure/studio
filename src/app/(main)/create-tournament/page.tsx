
"use client";

import { useState } from 'react';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { CalendarIcon, Loader2, PlusSquare } from "lucide-react";
import { createTournament } from '@/lib/tournament-service';
import type { TournamentSettings } from '@/lib/types';

const tournamentFormSchema = z.object({
  name: z.string().min(3, { message: "Tournament name must be at least 3 characters." }).max(100),
  teamCount: z.coerce.number().refine(val => [4, 8, 16].includes(val), {
    message: "Number of teams must be 4, 8, or 16.",
  }),
  startDate: z.date({
    required_error: "A start date is required.",
  }),
});

type TournamentFormValues = z.infer<typeof tournamentFormSchema>;

export default function CreateTournamentPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<TournamentFormValues>({
    resolver: zodResolver(tournamentFormSchema),
    defaultValues: {
      name: "",
      // teamCount will be set by Select, zod will coerce string to number
    },
  });

  async function onSubmit(data: TournamentFormValues) {
    setIsSubmitting(true);
    const settings: TournamentSettings = {
      name: data.name,
      teamCount: data.teamCount as 4 | 8 | 16, // Zod ensures it's one of these
      startDate: data.startDate,
    };

    const result = await createTournament(settings);

    if (result.success) {
      toast({
        title: "Tournament Created!",
        description: `Tournament "${data.name}" has been successfully created with ID: ${result.id}.`,
        variant: "default",
        className: "bg-green-100 border-green-500 text-green-700 dark:bg-green-800 dark:text-green-200 dark:border-green-600"
      });
      form.reset(); 
    } else {
      toast({
        title: "Error Creating Tournament",
        description: result.error || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
    setIsSubmitting(false);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 p-4 bg-card rounded-lg shadow">
        <h1 className="font-headline text-3xl md:text-4xl font-bold text-primary flex items-center">
          <PlusSquare className="mr-3 h-8 w-8" /> Create New Tournament
        </h1>
      </div>

      <Card className="max-w-2xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Tournament Details</CardTitle>
          <CardDescription>Fill in the information below to set up a new tournament.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tournament Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Annual Championship" {...field} className="bg-input" />
                    </FormControl>
                    <FormDescription>
                      Choose a descriptive name for your tournament.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="teamCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Teams</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                      <FormControl>
                        <SelectTrigger className="bg-input">
                          <SelectValue placeholder="Select number of teams" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="4">4 Teams</SelectItem>
                        <SelectItem value="8">8 Teams</SelectItem>
                        <SelectItem value="16">16 Teams</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      The total number of teams participating.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="startDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full pl-3 text-left font-normal bg-input",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick a date</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) =>
                            date < new Date(new Date().setDate(new Date().getDate() -1)) // Disable past dates
                          }
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      The official start date of the tournament.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={isSubmitting}>
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <PlusSquare className="mr-2 h-4 w-4" />
                )}
                Create Tournament
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
