import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight, CheckCircle, Star, Trophy, Calendar, Users, Target, Award, Clock, DollarSign } from "lucide-react"
import Link from "next/link"

export default function BPOGamesLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Header */}
      

      {/* Hero Section */}
      <section className="py-16 lg:py-24">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge variant="secondary" className="mb-6 px-4 py-2 bg-[#0a7578]/10 text-[#0a7578]">
                🏆 Registration Open - Deadline June 9th
              </Badge>

              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
                The{" "}
                <span className=" ">
                  BPO Games
                </span>
              </h1>

              <h2 className="text-2xl md:text-3xl font-semibold text-gray-700 mb-6">2025 Pakistani Super League</h2>

              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                The Ultimate Call Center Throwdown! Join Pakistan's most competitive BPO tournament where
                <strong> 16 teams</strong> battle for glory and <strong>$4,500 in prizes</strong> over 6 intense weeks.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-[#0a7578] to-[#b17e1e] hover:from-[#0a7578]/90 hover:to-[#b17e1e]/90 text-lg px-8 py-6"
                >
                  Register Your Team
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="text-lg px-8 py-6 border-[#0a7578] text-[#0a7578] hover:bg-[#0a7578]/5"
                >
                  Download Rules
                </Button>
              </div>

              <div className="flex items-center justify-start space-x-8 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>Free to participate</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>6-week tournament</span>
                </div>
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span>$4,500 total prizes</span>
                </div>
              </div>
            </div>

            {/* Hero Image Space */}
            <div className="relative">
              <img
                src="/landing/hero.jpg"
                alt="BPO Games Hero"
                width={600}
                height={600}
                className="rounded-3xl shadow-lg object-cover w-full h-auto aspect-square"
              />
              {/* Floating elements */}
              <div className="absolute -top-4 -right-4 bg-white rounded-full p-3 shadow-lg">
                <Trophy className="w-6 h-6 text-[#b17e1e]" />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-white rounded-full p-3 shadow-lg">
                <Target className="w-6 h-6 text-[#0a7578]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament Stats */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold text-orange-600 mb-2">16</div>
              <div className="text-muted-foreground font-medium">Competing Teams</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-red-600 mb-2">6</div>
              <div className="text-muted-foreground font-medium">Weeks of Competition</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-green-600 mb-2">$4.5K</div>
              <div className="text-muted-foreground font-medium">Total Prize Pool</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold text-[#0a7578] mb-2">100+</div>
              <div className="text-muted-foreground font-medium">Sales Required/Month</div>
            </div>
          </div>
        </div>
      </section>

      {/* Tournament Format Section */}
      <section id="tournament" className="py-20 bg-gradient-to-b from-[#0a7578]/5 to-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-[#0a7578]/10 text-[#0a7578]">
              Tournament Format
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              How the{" "}
              <span className=" ">
                Competition
              </span>{" "}
              Works
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A bracket-style knockout tournament where teams compete daily for points. First to 3 points advances!
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center mb-16">
            <div className="space-y-6">
              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-[#0a7578]/10 rounded-lg flex items-center justify-center mb-4">
                    <Target className="w-6 h-6 text-[#0a7578]" />
                  </div>
                  <CardTitle>Daily Competition</CardTitle>
                  <CardDescription>
                    Each day equals 1 point. Teams compete Monday through Friday in head-to-head matchups.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-[#b17e1e]/10 rounded-lg flex items-center justify-center mb-4">
                    <Trophy className="w-6 h-6 text-red-600" />
                  </div>
                  <CardTitle>First to 3 Wins</CardTitle>
                  <CardDescription>
                    The first team to win 3 daily competitions advances to the next round. Lose 3 and you're eliminated.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4">
                    <Users className="w-6 h-6 text-green-600" />
                  </div>
                  <CardTitle>Knockout Style</CardTitle>
                  <CardDescription>
                    16 teams start, only 1 remains! Each week eliminates teams until we crown our champion.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Tournament Bracket Image Space */}
            <div className="relative">
              <img
                src="/landing/bracket.png"
                alt="Tournament Bracket"
                width={800}
                height={600}
                className="rounded-2xl shadow-lg object-cover w-full h-auto aspect-[4/3] border-2 border-dashed border-[#0a7578]/30"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Rules Section */}
      <section id="rules" className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-[#b17e1e]/10 text-[#b17e1e]">
              Competition Rules
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Tournament{" "}
              <span className=" ">Rules</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8 w-1/2 mx-auto text-center">
            <Card className="border-l-4 border-l-[#0a7578] shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-orange-600" />
                  <span>Weekly Format</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>5 competitive days per week (Monday-Friday)</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Each day counts as 1 game/point</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Weekend breaks between rounds</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#b17e1e] shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="w-5 h-5 text-red-600" />
                  <span>Qualification Requirements</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Minimum 100 sales submissions per month</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Must qualify to be eligible for cash prizes</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Teams registered by June 9th deadline</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-600 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5 text-green-600" />
                  <span>Advancement Rules</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>First team to win 3 games advances</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Lose 3 games and you're eliminated</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Knockout-style elimination</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-[#0a7578] shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Award className="w-5 h-5 text-blue-600" />
                  <span>Winner Benefits</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Social media recognition</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Dedicated account manager for 1 month</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <span>Championship trophy and certificates</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Schedule Section */}
      <section id="schedule" className="py-20 bg-gradient-to-b from-[#0a7578]/5 to-white">
  <div className="container mx-auto px-4 lg:px-6">
    <div className="text-center mb-16">
      <Badge variant="secondary" className="mb-4 bg-[#0a7578]/10 text-[#0a7578]">
        Tournament Schedule
      </Badge>
      <h2 className="text-3xl md:text-5xl font-bold mb-4">
        Competition{" "}
        <span className=" ">
          Timeline
        </span>
      </h2>
      <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
        Mark your calendars! Here's the complete schedule for the 2025 BPO Games tournament.
      </p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 justify-center items-start">
      {/* Registration Deadline */}
      <Card className="w-full max-w-sm border-0 shadow-lg bg-gradient-to-r from-[#0b1821] to-[#0a7578] text-white">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Registration Deadline</CardTitle>
              <CardDescription className="text-red-100">Last chance to register!</CardDescription>
            </div>
            <Clock className="w-8 h-8" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-center">June 9th, 2025</div>
        </CardContent>
      </Card>

      {/* Qualifying Week */}
      <Card className="w-full max-w-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Qualifying Week</CardTitle>
            <Badge variant="outline">Week 0</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-[#0a7578] text-center">June 9-13, 2025</div>
        </CardContent>
      </Card>

      {/* Round 1 */}
      <Card className="w-full max-w-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Round 1</CardTitle>
            <Badge variant="outline">16 → 8 Teams</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-[#0a7578] text-center">June 16-20, 2025</div>
        </CardContent>
      </Card>

      {/* Round 2 */}
      <Card className="w-full max-w-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Round 2</CardTitle>
            <Badge variant="outline">8 → 4 Teams</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-[#0a7578] text-center">June 23-27, 2025</div>
        </CardContent>
      </Card>

      {/* Round 3 */}
      <Card className="w-full max-w-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Round 3</CardTitle>
            <Badge variant="outline">4 → 2 Teams</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-[#0a7578] text-center">June 30 - July 4, 2025</div>
        </CardContent>
      </Card>

      {/* Semifinals */}
      <Card className="w-full max-w-sm border-0 shadow-lg hover:shadow-xl transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Semifinals</CardTitle>
            <Badge variant="outline">Final 4</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-[#0a7578] text-center">July 7-11, 2025</div>
        </CardContent>
      </Card>

      {/* Championship Match */}
      <Card className="w-full max-w-sm shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-[#b17e1e]/5 to-[#0a7578]/5 border-2 border-[#b17e1e]/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-orange-600" />
              <span>Championship Match</span>
            </CardTitle>
            <Badge className="bg-orange-600">Final</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-[#0a7578] text-center">July 14, 2025</div>
        </CardContent>
      </Card>

      {/* Winner Announcement */}
      <Card className="w-full max-w-sm shadow-lg hover:shadow-xl transition-shadow bg-gradient-to-r from-[#0a7578]/5 to-[#b17e1e]/5 border-2 border-[#0a7578]/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Award className="w-5 h-5 text-green-600" />
              <span>Winner Announcement</span>
            </CardTitle>
            <Badge className="bg-green-600">Celebration</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-lg font-semibold text-green-600 text-center">July 21, 2025</div>
        </CardContent>
      </Card>
    </div>
  </div>
</section>


      {/* Prizes Section */}
      <section id="prizes" className="py-20 bg-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-green-100 text-green-700">
              Prize Pool
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Win Big with{" "}
              <span className=" ">$4,500</span>{" "}
              in Prizes
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Compete for cash prizes and exclusive benefits. The top 3 teams will be rewarded for their excellence.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mb-12">
            <Card className="border-2 border-[#b17e1e]/30 shadow-xl relative bg-gradient-to-b from-[#b17e1e]/10 to-[#0a7578]/5">
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-[#b17e1e] to-[#0a7578] text-white px-4 py-2">🥇 Champion</Badge>
              </div>
              <CardHeader className="text-center pb-8 pt-8">
                <Trophy className="w-16 h-16 text-[#b17e1e] mx-auto mb-4" />
                <CardTitle className="text-2xl">1st Place</CardTitle>
                <div className="text-5xl font-bold mt-4 text-[#b17e1e]">$3,000</div>
                <CardDescription className="mt-2 text-lg">The Ultimate Champions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>$3,000 cash prize</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Championship trophy</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Dedicated account manager</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Social media spotlight</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-gray-200 shadow-xl bg-gradient-to-b from-gray-50 to-slate-50">
              <CardHeader className="text-center pb-8">
                <Award className="w-14 h-14 text-gray-500 mx-auto mb-4" />
                <CardTitle className="text-2xl">2nd Place</CardTitle>
                <div className="text-4xl font-bold mt-4 text-gray-600">$1,000</div>
                <CardDescription className="mt-2">Runner-up Excellence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>$1,000 cash prize</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Runner-up trophy</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Social media recognition</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-amber-200 shadow-xl bg-gradient-to-b from-amber-50 to-yellow-50">
              <CardHeader className="text-center pb-8">
                <Star className="w-14 h-14 text-amber-500 mx-auto mb-4" />
                <CardTitle className="text-2xl">3rd Place</CardTitle>
                <div className="text-4xl font-bold mt-4 text-amber-600">$500</div>
                <CardDescription className="mt-2">Bronze Medal Winners</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>$500 cash prize</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Third place trophy</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Social media recognition</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Prize Image Space */}
          <div className="max-w-2xl mx-auto">
            <img
              src="/landing/prizes.jpg"
              alt="Prize Ceremony"
              width={800}
              height={400}
              className="rounded-2xl shadow-lg object-cover w-full h-auto aspect-[2/1] border-2 border-dashed border-[#0a7578]/30"
            />
          </div>
        </div>
      </section>

      {/* Testimonials/Past Winners */}
      <section className="py-20 bg-gradient-to-b from-[#0a7578]/5 to-white">
        <div className="container mx-auto px-4 lg:px-6">
          <div className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 bg-[#0a7578]/10 text-[#0a7578]">
              Success Stories
            </Badge>
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              What Teams Are{" "}
              <span className=" ">Saying</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar>
                    <AvatarImage src="/landing/testimonial1.jpg" width={80} height={80} />
                    <AvatarFallback>AK</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">Ahmed Khan</div>
                    <div className="text-sm text-muted-foreground">Team Lead, CallCenter Pro</div>
                  </div>
                </div>
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  "The BPO Games pushed our team to new heights! The competition format is brilliant and really brings
                  out the best in everyone. Can't wait for 2025!"
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar>
                    <AvatarImage src="/landing/testimonial2.jpg" width={80} height={80} />
                    <AvatarFallback>SF</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">Sarah Fatima</div>
                    <div className="text-sm text-muted-foreground">Manager, Elite Sales</div>
                  </div>
                </div>
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  "Winning 2nd place last year was incredible! The prize money helped us invest in better training. This
                  tournament is a game-changer for BPOs."
                </p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg">
              <CardHeader>
                <div className="flex items-center space-x-4 mb-4">
                  <Avatar>
                    <AvatarImage src="/landing/testimonial3.jpg" width={80} height={80} />
                    <AvatarFallback>MH</AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-semibold">Muhammad Hassan</div>
                    <div className="text-sm text-muted-foreground">CEO, TechCall Solutions</div>
                  </div>
                </div>
                <div className="flex space-x-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  "The competition brought our entire company together. Even teams that didn't make it far saw huge
                  improvements in performance and morale!"
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-[#0b1821] to-[#0a7578]">
        <div className="container mx-auto px-4 lg:px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">Ready to Compete?</h2>
          <p className="text-xl text-orange-100 mb-8 max-w-2xl mx-auto">
            Registration closes June 9th! Don't miss your chance to compete for $4,500 in prizes and become Pakistan's
            BPO champion.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <Button
              size="lg"
              variant="secondary"
              className="text-lg px-8 py-6 bg-white text-[#0a7578] hover:bg-gray-50"
            >
              Register Your Team Now
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8 py-6 text-white border-white hover:bg-white hover:text-[#0a7578]"
            >
              Download Tournament Guide
            </Button>
          </div>
          <div className="text-orange-100">
            <p className="font-semibold">
              ⚠️ Important: Teams must achieve 100+ sales submissions per month to qualify for cash prizes
            </p>
          </div>
        </div>
      </section>

      
    </div>
  )
}