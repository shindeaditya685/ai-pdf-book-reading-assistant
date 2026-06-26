'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, BookOpen, Loader2, Timer, Clock, FileText, MessageSquare,
  Mic, BookText, ChevronRight, CheckCircle2, XCircle, AlertCircle,
  Play, RefreshCw, Sparkles, BarChart3, GraduationCap, PenLine,
  Volume2, Brain, Star, Lightbulb, ListChecks, Target,
} from 'lucide-react'
import { useAuth } from '@/context/auth-context'
import { authFetch } from '@/lib/api'

// ── Band Score Ruler (signature element) ──

const BAND_LABELS = ['', '', '', '', '', '', '', '', '', ''] as const

function BandScoreRuler({ score, target = 7 }: { score: number | null; target?: number }) {
  const bands = [1, 2, 3, 4, 5, 6, 7, 8, 9]

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-5 py-4 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/40">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-serif text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 dark:text-stone-400">
          Estimated Band Score
        </span>
        {score !== null && (
          <span className="text-[11px] text-stone-400 dark:text-stone-500">
            Target: <span className="font-semibold text-stone-600 dark:text-stone-300">{target}.0</span>
          </span>
        )}
      </div>
      <div className="relative">
        <div className="flex h-8 items-center">
          {bands.map((band, i) => {
            const filled = score !== null && band <= score
            const isMarker = score !== null && Math.round(score) === band
            const segmentColor =
              band <= 4 ? 'bg-rose-200 dark:bg-rose-900/40' :
              band <= 6 ? 'bg-amber-200 dark:bg-amber-900/40' :
              'bg-orange-200 dark:bg-orange-900/40'

            return (
              <div key={band} className="relative flex-1">
                <div
                  className={`h-2 rounded-full transition-all duration-700 ${
                    i === 0 ? 'rounded-l-full' : i === bands.length - 1 ? 'rounded-r-full' : ''
                  } ${filled ? 'bg-orange-500 dark:bg-orange-500' : segmentColor}`}
                  style={{
                    marginLeft: i === 0 ? 0 : '-1px',
                    marginRight: i === bands.length - 1 ? 0 : '-1px',
                  }}
                />
                {isMarker && (
                  <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 shadow-[0_0_0_3px_rgba(234,88,12,0.2)] dark:shadow-[0_0_0_3px_rgba(234,88,12,0.35)]">
                      <span className="text-[9px] font-bold text-white">{score}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="mt-1.5 flex">
          {bands.map((band) => (
            <span
              key={band}
              className="flex-1 text-center text-[10px] font-medium text-stone-400 dark:text-stone-500"
            >
              {band}
            </span>
          ))}
        </div>
        {score === null && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="rounded-full bg-stone-100 px-4 py-1 text-[10px] font-semibold text-stone-400 dark:bg-stone-800 dark:text-stone-500">
              Complete a practice to see your band
            </span>
          </div>
        )}
      </div>
      <div className="mt-2 flex gap-3 text-[10px] text-stone-400 dark:text-stone-500">
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-300" />
          Limited (1–4)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
          Moderate (5–6)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-orange-300" />
          Proficient (7–9)
        </span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// DATA
// ═══════════════════════════════════════════════════════════════

interface IELTSQuestion {
  id: number
  type: 'mcq' | 'tfng' | 'heading' | 'completion'
  question: string
  options?: string[]
  answer: string
  explanation: string
}

interface IELTSReadingPassage {
  id: string
  title: string
  text: string
  questions: IELTSQuestion[]
  difficulty: 'easy' | 'medium' | 'hard'
  wordCount: number
}

const READING_PASSAGES: IELTSReadingPassage[] = [
  {
    id: 'water-supply',
    title: 'The Development of Municipal Water Supply',
    difficulty: 'medium',
    wordCount: 680,
    text: `The provision of clean water to urban populations has been one of the most significant engineering challenges throughout history. While ancient civilizations such as the Romans and Indus Valley peoples constructed impressive aqueducts and drainage systems, it was not until the 19th century that modern municipal water supply systems began to emerge in response to rapid urbanisation and industrialisation.

In the early 1800s, most city dwellers relied on wells, rivers, or private water carriers. As urban populations swelled, these sources became increasingly contaminated by sewage and industrial waste. The cholera epidemics that swept through European cities in the 1830s and 1840s highlighted the dire consequences of inadequate water supply and sanitation. In London, the Broad Street cholera outbreak of 1854, traced by Dr John Snow to a contaminated public water pump, became a landmark event in public health.

The technological response came in several forms. The invention of the steam pump enabled water to be lifted from rivers and distributed through iron pipes under pressure. Sand filtration, pioneered in Scotland by Robert Thom in the early 1800s, proved highly effective at removing pathogens. By the late 19th century, chlorination was introduced as a chemical disinfectant, dramatically reducing waterborne diseases.

The institutional framework also evolved. Municipalities began taking over water supply from private companies, recognising that clean water was a public good rather than a commodity. In the United States, cities like Boston and New York invested heavily in reservoir systems and aqueducts. The Boston Waterworks, completed in 1848, was one of the first comprehensive municipal systems. New York's Croton Aqueduct, opened in 1842, brought water from 40 miles away and was considered an engineering marvel of its time.

Today, modern water treatment plants use a multi-stage process including coagulation, sedimentation, filtration, and disinfection. However, many cities face new challenges: ageing infrastructure, population growth, climate change, and emerging contaminants such as microplastics and pharmaceutical residues. The UN estimates that 2.2 billion people worldwide still lack access to safely managed drinking water, reminding us that the struggle for clean water is far from over.`,
    questions: [
      {
        id: 1,
        type: 'tfng',
        question: 'The Romans were the first civilisation to build aqueducts.',
        answer: 'False',
        explanation: 'The passage states "ancient civilizations such as the Romans AND Indus Valley peoples" constructed aqueducts, implying the Indus Valley also built them. More importantly, the text does not claim the Romans were first — it mentions them alongside others.',
      },
      {
        id: 2,
        type: 'tfng',
        question: 'The Broad Street cholera outbreak was caused by contaminated water.',
        answer: 'True',
        explanation: 'The passage explicitly states the outbreak was "traced by Dr John Snow to a contaminated public water pump."',
      },
      {
        id: 3,
        type: 'tfng',
        question: 'Chlorination was introduced before sand filtration.',
        answer: 'False',
        explanation: 'Sand filtration was pioneered in the early 1800s, while chlorination was introduced in the late 19th century — after sand filtration.',
      },
      {
        id: 4,
        type: 'tfng',
        question: 'The Boston Waterworks was the first municipal water system in the United States.',
        answer: 'Not Given',
        explanation: 'The passage says Boston Waterworks was "one of the first" but does not specify whether it was the absolute first in the US.',
      },
      {
        id: 5,
        type: 'mcq',
        question: 'What does the writer identify as the MAIN driver for modern municipal water systems?',
        options: ['Industrialisation', 'Rapid urbanisation and industrialisation', 'The invention of the steam pump', 'Cholera epidemics'],
        answer: 'Rapid urbanisation and industrialisation',
        explanation: 'The first paragraph states systems "began to emerge in response to rapid urbanisation and industrialisation." Cholera epidemics highlighted the need but were not the main driver of the systems themselves.',
      },
      {
        id: 6,
        type: 'mcq',
        question: 'According to the passage, what is a current challenge facing water supply systems?',
        options: ['Lack of sand filtration technology', 'Ageing infrastructure', 'Insufficient chlorination', 'Private ownership of water companies'],
        answer: 'Ageing infrastructure',
        explanation: 'The final paragraph lists "ageing infrastructure" as one of the new challenges, along with population growth, climate change, and emerging contaminants.',
      },
      {
        id: 7,
        type: 'completion',
        question: 'Modern water treatment plants use a multi-stage process including coagulation, sedimentation, filtration, and __________.',
        answer: 'disinfection',
        explanation: 'The passage says "multi-stage process including coagulation, sedimentation, filtration, and disinfection."',
      },
    ],
  },
  {
    id: 'advertising-psychology',
    title: 'The Psychology of Advertising',
    difficulty: 'hard',
    wordCount: 720,
    text: `Advertising is often described as the art of persuasion, but beneath the creative surface lies a sophisticated understanding of human psychology. Modern advertisers draw on decades of research into cognitive biases, emotional triggers, and social influence to craft messages that resonate with consumers on a subconscious level.

One of the most powerful tools in the advertiser's arsenal is the concept of social proof. First articulated by psychologist Robert Cialdini, social proof refers to the tendency of people to conform to the behaviour of others. When an advertisement claims that "eight out of ten dentists recommend" a particular toothpaste, it is leveraging social proof to reduce uncertainty and build trust. Online reviews, testimonials, and user-generated content serve a similar function in digital advertising.

Another key principle is scarcity. The idea that limited availability increases desirability has been exploited by marketers for generations. Phrases such as "limited edition," "while stocks last," or "only 3 left in stock" create a sense of urgency that can override rational decision-making. Research has shown that scarcity not only increases perceived value but also accelerates the decision to purchase.

The mere exposure effect, a phenomenon identified by psychologist Robert Zajonc, suggests that people develop a preference for things simply because they are familiar with them. This is why advertisers strive for frequency of exposure — the more times a consumer sees a brand, the more positively they tend to feel about it, even if they do not consciously register the advertisement.

Emotional appeals are particularly effective. Neuroscientific studies using fMRI have demonstrated that emotional responses to advertisements are better predictors of purchase intent than rational evaluation of product features. Advertisements that evoke positive emotions such as happiness, nostalgia, or inspiration are more likely to be shared, remembered, and acted upon.

However, there is growing concern about the ethical implications of these techniques. Critics argue that exploiting cognitive vulnerabilities — particularly among children and adolescents — amounts to manipulation rather than persuasion. In response, some countries have introduced regulations limiting certain advertising practices, particularly in digital environments where targeting can be highly personalised and difficult to detect.`,
    questions: [
      {
        id: 1,
        type: 'heading',
        question: 'Choose the correct heading for paragraph 2.',
        options: ['The ethical debate around advertising', 'How scarcity increases desire', 'The power of social conformity', 'The role of emotions in advertising'],
        answer: 'The power of social conformity',
        explanation: 'Paragraph 2 discusses social proof — the tendency to conform to others\' behaviour — which is about social conformity.',
      },
      {
        id: 2,
        type: 'heading',
        question: 'Choose the correct heading for paragraph 3.',
        options: ['The ethical debate around advertising', 'How scarcity increases desire', 'The power of social conformity', 'The role of emotions in advertising'],
        answer: 'How scarcity increases desire',
        explanation: 'Paragraph 3 discusses the scarcity principle — limited availability increasing desirability.',
      },
      {
        id: 3,
        type: 'heading',
        question: 'Choose the correct heading for paragraph 5.',
        options: ['The ethical debate around advertising', 'How scarcity increases desire', 'The power of social conformity', 'The role of emotions in advertising'],
        answer: 'The role of emotions in advertising',
        explanation: 'Paragraph 5 discusses emotional appeals and how they affect purchase intent.',
      },
      {
        id: 4,
        type: 'mcq',
        question: 'According to the passage, what is the "mere exposure effect"?',
        options: [
          'People buy more when products are scarce',
          'People prefer things they are familiar with',
          'People follow the behaviour of others',
          'People respond better to emotional ads',
        ],
        answer: 'People prefer things they are familiar with',
        explanation: 'The mere exposure effect is defined as "people develop a preference for things simply because they are familiar with them."',
      },
      {
        id: 5,
        type: 'tfng',
        question: 'Neuroscientific studies show that rational evaluation is a better predictor of purchase intent than emotional response.',
        answer: 'False',
        explanation: 'The passage states "emotional responses to advertisements are better predictors of purchase intent than rational evaluation of product features."',
      },
      {
        id: 6,
        type: 'tfng',
        question: 'All countries have introduced regulations to limit manipulative advertising practices.',
        answer: 'False',
        explanation: 'The passage says "some countries have introduced regulations" — not all.',
      },
      {
        id: 7,
        type: 'completion',
        question: 'The concept of social proof was first articulated by psychologist __________.',
        answer: 'Robert Cialdini',
        explanation: 'The passage states "First articulated by psychologist Robert Cialdini."',
      },
    ],
  },
  {
    id: 'animal-navigation',
    title: 'Animal Navigation: Nature\'s GPS',
    difficulty: 'easy',
    wordCount: 550,
    text: `Every year, the Arctic tern migrates from the Arctic to the Antarctic and back — a round trip of approximately 70,000 kilometres. How these small birds navigate such vast distances with remarkable precision has fascinated scientists for decades.

Research has revealed that animals use a variety of navigational strategies. Many birds, including pigeons and swallows, use the sun as a compass. By measuring the angle of the sun relative to their internal circadian clock, they can determine direction even when the sun is obscured by clouds. At night, some birds use the stars for orientation — a skill that young birds appear to learn by observing the rotation of the night sky.

Magnetic fields play a crucial role in animal navigation. Sea turtles, for example, are known to sense the Earth's magnetic field. Loggerhead turtles born on the beaches of Florida travel thousands of kilometres across the Atlantic and return to the exact same beach to lay their eggs. Scientists believe they use magnetic signatures to navigate, essentially reading a "magnetic map" that allows them to determine their location relative to their destination.

Bees and ants also demonstrate impressive navigational abilities. Honeybees communicate the location of food sources to their hive mates through a sophisticated dance language. Desert ants of the Sahara navigate using a technique called path integration, constantly updating a mental record of their direction and distance from the nest. When they find food, they can take a direct route home, even across featureless terrain.

Not all animals rely on the same cues, however. Salmon use their sense of smell to identify the chemical signature of their home river. Bats use echolocation to navigate in complete darkness. And some species, such as the monarch butterfly, appear to have genetic programming that guides their multi-generational migrations — butterflies that have never made the journey before somehow know the route.`,
    questions: [
      {
        id: 1,
        type: 'mcq',
        question: 'How far does the Arctic tern migrate round trip?',
        options: ['7,000 kilometres', '70,000 kilometres', '17,000 kilometres', '700 kilometres'],
        answer: '70,000 kilometres',
        explanation: 'The passage says "approximately 70,000 kilometres" for the round trip.',
      },
      {
        id: 2,
        type: 'mcq',
        question: 'What does the author suggest about young birds using stars for navigation?',
        options: ['They are born with this knowledge', 'They learn it from observing the sky', 'They learn it from their parents', 'They do not use stars'],
        answer: 'They learn it from observing the sky',
        explanation: 'The passage states "a skill that young birds appear to learn by observing the rotation of the night sky."',
      },
      {
        id: 3,
        type: 'tfng',
        question: 'Loggerhead turtles use the sun to navigate across the Atlantic.',
        answer: 'Not Given',
        explanation: 'The passage says loggerheads use "magnetic signatures" to navigate. It does not mention them using the sun.',
      },
      {
        id: 4,
        type: 'tfng',
        question: 'Desert ants use path integration to find their way home.',
        answer: 'True',
        explanation: 'The passage states "Desert ants navigate using a technique called path integration."',
      },
      {
        id: 5,
        type: 'tfng',
        question: 'Salmon rely primarily on vision to identify their home river.',
        answer: 'False',
        explanation: 'Salmon use "their sense of smell to identify the chemical signature of their home river" — not vision.',
      },
      {
        id: 6,
        type: 'completion',
        question: 'Monarch butterfly migrations appear to be guided by __________ programming.',
        answer: 'genetic',
        explanation: 'The passage says "genetic programming that guides their multi-generational migrations."',
      },
    ],
  },
]

interface WritingTask {
  id: string
  type: 'task1' | 'task2'
  title: string
  prompt: string
  tips: string[]
  timeMinutes: number
}

const WRITING_TASKS: WritingTask[] = [
  {
    id: 'writing-task1-1',
    type: 'task1',
    title: 'Task 1: Line Graph',
    timeMinutes: 20,
    prompt: `The graph below shows the consumption of renewable energy in five countries from 2000 to 2020.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

[Data: Country A increased from 5% to 45%; Country B from 8% to 35%; Country C from 3% to 25%; Country D from 12% to 30%; Country E from 2% to 50%. All countries showed a general upward trend, with Country E experiencing the most dramatic growth and Country C the steadiest increase.]`,
    tips: [
      'Start with an overview sentence describing the overall trend',
      'Use comparison language: "similarly", "in contrast", "while", "whereas"',
      'Do not give reasons or explanations — just describe the data',
      'Include specific figures to support your description',
      'Aim for 150 words minimum',
    ],
  },
  {
    id: 'writing-task1-2',
    type: 'task1',
    title: 'Task 1: Bar Chart',
    timeMinutes: 20,
    prompt: `The bar chart below shows the average time (in minutes per day) spent on different types of media by UK teenagers in 2010 and 2020.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

[Data: Watching TV: 120 min (2010) → 75 min (2020); Social media: 45 min → 120 min; Gaming: 60 min → 85 min; Reading: 30 min → 25 min; Music streaming: 20 min → 65 min; Podcasts: 5 min → 30 min.]`,
    tips: [
      'Organise your answer by comparing the two years',
      'Group similar trends together',
      'Use appropriate tense (past tense for 2010, appropriate tense for changes)',
      'Avoid listing every single number — highlight key differences',
      'Aim for 150 words minimum',
    ],
  },
  {
    id: 'writing-task1-3',
    type: 'task1',
    title: 'Task 1: Process Diagram',
    timeMinutes: 20,
    prompt: `The diagram below shows the process of producing bottled water for commercial sale.

Summarise the information by selecting and reporting the main features, and make comparisons where relevant.

[Process: 1. Water sourced from natural spring → 2. Pumped to treatment facility → 3. Filtered through sand and carbon → 4. Ozonated for disinfection → 5. Filled into sterilised bottles → 6. Capped and sealed → 7. Labelled and date-coded → 8. Packed into boxes → 9. Transported to distributors → 10. Sold in retail stores.]`,
    tips: [
      'Use sequencing language: "first", "next", "after that", "finally"',
      'Use passive voice: "the water is filtered", "the bottles are filled"',
      'Describe stages in order — do not skip steps',
      'Group related steps into logical paragraphs',
      'Aim for 150 words minimum',
    ],
  },
  {
    id: 'writing-task2-1',
    type: 'task2',
    title: 'Task 2: Opinion Essay',
    timeMinutes: 40,
    prompt: `Some people believe that technology has made our lives more complex and stressful, while others argue that it has simplified our lives and improved our quality of living.

Discuss both these views and give your own opinion.`,
    tips: [
      'Spend 5 minutes planning before you start writing',
      'Write a clear introduction paraphrasing the question and stating your position',
      'Dedicate one paragraph to each view with specific examples',
      'State your own opinion clearly in a separate paragraph',
      'Write 250-280 words — do not go over 300',
      'Conclude by summarising your position',
    ],
  },
  {
    id: 'writing-task2-2',
    type: 'task2',
    title: 'Task 2: Discussion Essay',
    timeMinutes: 40,
    prompt: `In many countries, the number of young people choosing to study science subjects at university is declining.

What are the causes of this trend, and what measures could be taken to encourage more students to pursue science?`,
    tips: [
      'Address both parts of the question equally',
      'For causes: consider social, economic, and educational factors',
      'For measures: suggest practical solutions at different levels (school, government, media)',
      'Use specific examples to support your points',
      'Aim for 250-280 words',
    ],
  },
  {
    id: 'writing-task2-3',
    type: 'task2',
    title: 'Task 2: Problem/Solution Essay',
    timeMinutes: 40,
    prompt: `The amount of waste produced by households in developed countries is increasing at an alarming rate.

What are the reasons for this increase, and what can be done to reduce household waste?`,
    tips: [
      'Identify 2-3 main causes with clear explanations',
      'Propose specific solutions that directly address each cause',
      'Consider individual responsibility vs government action',
      'Use data or examples to strengthen your arguments',
      'Aim for 250-280 words',
    ],
  },
]

interface CueCard {
  id: string
  part: 1 | 2 | 3
  question: string
  followUp?: string[]
  prepTime?: number
  speakTime?: number
}

const SPEAKING_CARDS: CueCard[] = [
  {
    part: 1,
    id: 'p1-work',
    question: 'Do you work or are you a student?\n\n• What do you do?\n• Do you enjoy it?\n• What is the most interesting part of your work/studies?',
    followUp: ['Would you like to change your job/course in the future?', 'What skills do you need for your work/studies?'],
  },
  {
    part: 1,
    id: 'p1-home',
    question: 'Where do you live?\n\n• Can you describe your hometown?\n• What do you like about the place where you live?\n• Has your neighbourhood changed in recent years?',
    followUp: ['Is it a good place for young people?', 'Would you prefer to live in a city or the countryside?'],
  },
  {
    part: 1,
    id: 'p1-hobbies',
    question: 'Do you have any hobbies?\n\n• What do you enjoy doing in your free time?\n• How long have you been doing this?\n• Why do you enjoy it?',
    followUp: ['Do you prefer indoor or outdoor activities?', 'Did you have different hobbies as a child?'],
  },
  {
    part: 2,
    id: 'p2-person',
    prepTime: 60,
    speakTime: 120,
    question: `Describe a person who has had a significant influence on your life.

You should say:
• Who this person is
• How you know them
• What qualities they have
• And explain why they have influenced you so much`,
    followUp: ['What qualities do you think make someone a good role model?', 'Do you think people\'s personalities are shaped more by nature or nurture?'],
  },
  {
    part: 2,
    id: 'p2-place',
    prepTime: 60,
    speakTime: 120,
    question: `Describe a place you have visited that you found particularly beautiful.

You should say:
• Where this place is
• When you went there
• What you saw and did there
• And explain why you found it so beautiful`,
    followUp: ['Do you prefer natural or man-made beauty?', 'Why do you think people enjoy travelling to beautiful places?'],
  },
  {
    part: 2,
    id: 'p2-book',
    prepTime: 60,
    speakTime: 120,
    question: `Describe a book that you have read that you found memorable.

You should say:
• What the book was about
• When you read it
• Why you decided to read it
• And explain why it was memorable to you`,
    followUp: ['Has reading habits changed with technology?', 'Do you think physical books will disappear in the future?'],
  },
  {
    part: 2,
    id: 'p2-experience',
    prepTime: 60,
    speakTime: 120,
    question: `Describe an achievement you are proud of.

You should say:
• What you achieved
• When and where it happened
• How you accomplished it
• And explain why you are proud of this achievement`,
    followUp: ['How important is it to celebrate achievements?', 'Do you think people set realistic goals for themselves?'],
  },
  {
    part: 3,
    id: 'p3-education',
    question: 'Let\'s talk about education.\n\n• How has education changed in your country in recent years?\n• What makes a good teacher?\n• Do you think the current education system prepares students for the future?\n• Should university education be free for everyone?',
  },
  {
    part: 3,
    id: 'p3-technology',
    question: 'Let\'s talk about technology.\n\n• How has technology affected the way people communicate?\n• What are the disadvantages of relying too much on technology?\n• Do you think older generations struggle more with technology?\n• What technological development do you think will have the biggest impact in the next decade?',
  },
  {
    part: 3,
    id: 'p3-environment',
    question: 'Let\'s talk about the environment.\n\n• What do you think are the biggest environmental problems today?\n• Should governments or individuals be responsible for protecting the environment?\n• Do you think people are becoming more environmentally aware?\n• What can be done to encourage more sustainable behaviour?',
  },
]

interface VocabItem {
  word: string
  definition: string
  example: string
}

interface VocabTopic {
  topic: string
  icon: string
  items: VocabItem[]
}

const VOCAB_TOPICS: VocabTopic[] = [
  {
    topic: 'Academic Word List (Sublist 1)',
    icon: '🎓',
    items: [
      { word: 'analyse', definition: 'to examine something in detail', example: 'Researchers analyse data to identify patterns.' },
      { word: 'approach', definition: 'a way of dealing with something', example: 'We need a new approach to solving this problem.' },
      { word: 'assess', definition: 'to evaluate or estimate', example: 'Teachers assess students\' progress regularly.' },
      { word: 'concept', definition: 'an abstract idea', example: 'The concept of democracy originated in ancient Greece.' },
      { word: 'context', definition: 'the circumstances surrounding something', example: 'Words must be understood in context.' },
      { word: 'establish', definition: 'to set up or create', example: 'The company was established in 1995.' },
      { word: 'identify', definition: 'to recognise or establish identity', example: 'Scientists identified a new species of frog.' },
      { word: 'interpret', definition: 'to explain the meaning of', example: 'How do you interpret the results?' },
      { word: 'major', definition: 'important, serious, or significant', example: 'Pollution is a major problem in urban areas.' },
      { word: 'method', definition: 'a particular way of doing something', example: 'This method is more efficient than the old one.' },
      { word: 'occur', definition: 'to happen or take place', example: 'Earthquakes occur without warning.' },
      { word: 'percent', definition: 'one part in a hundred', example: 'Over 80 percent of students passed the exam.' },
      { word: 'period', definition: 'a length of time', example: 'The Renaissance was a period of great artistic achievement.' },
      { word: 'process', definition: 'a series of steps or actions', example: 'The manufacturing process takes three days.' },
      { word: 'require', definition: 'to need or demand', example: 'This job requires excellent communication skills.' },
      { word: 'research', definition: 'systematic investigation', example: 'Further research is needed to confirm these findings.' },
      { word: 'respond', definition: 'to answer or react', example: 'The government must respond to the crisis.' },
      { word: 'role', definition: 'the function or position of something', example: 'Technology plays a crucial role in education.' },
      { word: 'section', definition: 'a distinct part or division', example: 'Read section three for homework.' },
      { word: 'theory', definition: 'a system of ideas explaining something', example: 'Einstein\'s theory of relativity changed physics.' },
    ],
  },
  {
    topic: 'Environment & Climate',
    icon: '🌍',
    items: [
      { word: 'biodiversity', definition: 'the variety of plant and animal life', example: 'Deforestation threatens biodiversity in tropical regions.' },
      { word: 'carbon footprint', definition: 'the amount of CO2 produced by an activity', example: 'Taking public transport reduces your carbon footprint.' },
      { word: 'conservation', definition: 'the protection of the natural environment', example: 'Wildlife conservation efforts have helped save endangered species.' },
      { word: 'ecosystem', definition: 'a community of interacting organisms and their environment', example: 'Coral reefs are among the most diverse ecosystems on Earth.' },
      { word: 'emission', definition: 'the release of gases or substances into the air', example: 'Vehicle emissions are a major source of air pollution.' },
      { word: 'fossil fuels', definition: 'natural fuels formed from ancient organic matter', example: 'The world must reduce its dependence on fossil fuels.' },
      { word: 'global warming', definition: 'the gradual increase in Earth\'s temperature', example: 'Global warming is causing polar ice caps to melt.' },
      { word: 'renewable', definition: 'energy from sources that can be replenished', example: 'Solar and wind power are both renewable energy sources.' },
      { word: 'sustainable', definition: 'able to be maintained long-term without harming the environment', example: 'Sustainable farming practices protect soil health.' },
      { word: 'deforestation', definition: 'the clearing of forests on a large scale', example: 'Deforestation contributes to climate change.' },
    ],
  },
  {
    topic: 'Technology & Digital',
    icon: '💻',
    items: [
      { word: 'artificial intelligence', definition: 'computer systems that can perform tasks requiring human intelligence', example: 'AI is transforming industries from healthcare to finance.' },
      { word: 'automation', definition: 'the use of technology to perform tasks without human input', example: 'Automation has reduced the need for manual labour in factories.' },
      { word: 'cybersecurity', definition: 'protection of computer systems from attacks', example: 'Companies invest heavily in cybersecurity to protect data.' },
      { word: 'algorithm', definition: 'a set of rules followed in problem-solving operations', example: 'Search engines use complex algorithms to rank results.' },
      { word: 'innovation', definition: 'a new method, idea, or product', example: 'Technological innovation drives economic growth.' },
      { word: 'digital divide', definition: 'the gap between those with and without access to technology', example: 'The digital divide affects rural communities disproportionately.' },
      { word: 'data privacy', definition: 'the protection of personal information', example: 'Data privacy regulations have become stricter worldwide.' },
      { word: 'disruptive', definition: 'causing significant change to existing industries', example: 'Streaming services were disruptive to traditional television.' },
    ],
  },
  {
    topic: 'Health & Medicine',
    icon: '🏥',
    items: [
      { word: 'preventive', definition: 'intended to stop something from happening', example: 'Preventive healthcare reduces the burden on hospitals.' },
      { word: 'chronic', definition: 'persisting for a long time or constantly recurring', example: 'Chronic diseases like diabetes require ongoing management.' },
      { word: 'epidemic', definition: 'a widespread occurrence of a disease', example: 'The obesity epidemic is a growing concern worldwide.' },
      { word: 'immunisation', definition: 'the process of making a person immune to a disease', example: 'Childhood immunisation programmes save millions of lives.' },
      { word: 'mental health', definition: 'a person\'s psychological and emotional well-being', example: 'Employers are increasingly focusing on mental health support.' },
      { word: 'nutrition', definition: 'the process of providing food for health and growth', example: 'Good nutrition is essential for children\'s development.' },
      { word: 'diagnosis', definition: 'the identification of a condition or disease', example: 'Early diagnosis significantly improves treatment outcomes.' },
      { word: 'wellness', definition: 'the state of being in good health', example: 'Corporate wellness programmes can reduce employee stress.' },
    ],
  },
  {
    topic: 'Education & Learning',
    icon: '📚',
    items: [
      { word: 'curriculum', definition: 'the subjects in a course of study', example: 'The national curriculum includes both academic and vocational subjects.' },
      { word: 'pedagogy', definition: 'the method and practice of teaching', example: 'Modern pedagogy emphasises student-centred learning.' },
      { word: 'literacy', definition: 'the ability to read and write', example: 'Improving literacy rates is a priority in developing countries.' },
      { word: 'assessment', definition: 'the evaluation of student learning', example: 'Continuous assessment provides a clearer picture of progress.' },
      { word: 'vocational', definition: 'relating to an occupation or employment', example: 'Vocational training prepares students for specific careers.' },
      { word: 'competency', definition: 'the ability to do something successfully', example: 'Students must demonstrate competency in core subjects.' },
      { word: 'enrolment', definition: 'the act of registering for a course', example: 'University enrolment has increased significantly in the past decade.' },
      { word: 'tuition', definition: 'teaching or instruction, especially in small groups', example: 'Private tuition can help students prepare for exams.' },
    ],
  },
  {
    topic: 'Crime & Justice',
    icon: '⚖️',
    items: [
      { word: 'deterrent', definition: 'something that discourages an action', example: 'Longer prison sentences are intended as a deterrent to crime.' },
      { word: 'rehabilitation', definition: 'the process of restoring someone to a normal life', example: 'Prison systems should focus on rehabilitation rather than punishment.' },
      { word: 'recidivism', definition: 'the tendency of a convicted criminal to reoffend', example: 'Programs that provide job training reduce recidivism rates.' },
      { word: 'juvenile', definition: 'relating to young people (under 18)', example: 'The juvenile justice system focuses on reform rather than punishment.' },
      { word: 'offence', definition: 'a breach of law or rule', example: 'The offence carries a maximum penalty of ten years.' },
      { word: 'verdict', definition: 'a decision made by a jury', example: 'The jury reached a unanimous verdict of not guilty.' },
      { word: 'legislation', definition: 'laws enacted by a governing body', example: 'New legislation aims to combat cybercrime.' },
      { word: 'accountability', definition: 'responsibility for one\'s actions', example: 'Police accountability is essential for public trust.' },
    ],
  },
]

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

function TimerDisplay({ seconds, className }: { seconds: number; className?: string }) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return (
    <span className={`tabular-nums ${m < 5 ? 'text-rose-500' : m < 10 ? 'text-amber-500' : 'text-orange-500'} ${className || ''}`}>
      {String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
    </span>
  )
}

function useTimer(initialSeconds: number, onExpire?: () => void) {
  const [seconds, setSeconds] = useState(initialSeconds)
  const [running, setRunning] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            setRunning(false)
            onExpire?.()
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, onExpire])

  const start = useCallback(() => setRunning(true), [])
  const pause = useCallback(() => setRunning(false), [])
  const reset = useCallback((s?: number) => {
    setRunning(false)
    if (s !== undefined) setSeconds(s)
    else setSeconds(initialSeconds)
  }, [initialSeconds])

  return { seconds, running, start, pause, reset }
}

// ═══════════════════════════════════════════════════════════════
// READING MODULE
// ═══════════════════════════════════════════════════════════════

function ReadingModule({ onScoreUpdate }: { onScoreUpdate?: (score: number) => void }) {
  const [passageIndex, setPassageIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const [started, setStarted] = useState(false)
  const timer = useTimer(1200, () => setShowResults(true))

  const [allPassages, setAllPassages] = useState<IELTSReadingPassage[]>([...READING_PASSAGES])
  const [aiTopic, setAiTopic] = useState('')
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')

  const passage = allPassages[passageIndex]
  const questions = passage.questions

  const handleAnswer = (qId: number, answer: string) => {
    setAnswers((prev) => ({ ...prev, [qId]: answer }))
  }

  const handleSubmit = () => {
    setSubmitted(true)
    setShowResults(true)
  }

  const isAnswerCorrect = useCallback((q: IELTSQuestion, userAnswer: string) => {
    if (!userAnswer) return false
    if (q.type === 'completion') {
      return userAnswer.toLowerCase().trim() === q.answer.toLowerCase().trim()
    }
    return userAnswer === q.answer
  }, [])

  const score = questions.filter((q) => isAnswerCorrect(q, answers[q.id])).length
  const band = score >= 7 ? 9 : score >= 6 ? 8 : score >= 5 ? 7 : score >= 4 ? 6 : score >= 3 ? 5 : 4

  useEffect(() => {
    if (showResults) onScoreUpdate?.(band)
  }, [showResults, band, onScoreUpdate])

  const startPassage = () => {
    setAnswers({})
    setSubmitted(false)
    setShowResults(false)
    timer.reset(1200)
    timer.start()
    setStarted(true)
  }

  const changePassage = (idx: number) => {
    setPassageIndex(idx)
    setAnswers({})
    setSubmitted(false)
    setShowResults(false)
    setStarted(false)
    timer.reset(1200)
  }

  const generatePassage = async () => {
    if (!aiTopic.trim()) return
    setGenerating(true)
    setGenError('')
    try {
      const res = await authFetch('/api/ielts/generate-passage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim(), difficulty: aiDifficulty }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate passage')
      }
      const data = await res.json()
      const newPassage: IELTSReadingPassage = {
        id: `ai-${Date.now()}`,
        title: data.title,
        text: data.text,
        questions: data.questions,
        difficulty: data.difficulty,
        wordCount: data.wordCount,
      }
      setAllPassages((prev) => [...prev, newPassage])
      setPassageIndex(allPassages.length)
      setAiTopic('')
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* AI Generate section */}
      <div className="rounded-xl border border-orange-200/50 bg-white p-4 shadow-sm dark:border-orange-800/30 dark:bg-stone-900/60">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 shadow-sm dark:bg-white">
            <Sparkles className="h-4 w-4 text-white dark:text-stone-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Generate IELTS Passage with AI</p>
            <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">Enter any topic — AI creates a full passage with questions following IELTS format</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !generating) generatePassage() }}
                placeholder="e.g. Solar energy, Ocean pollution, The history of maps..."
                className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
                disabled={generating}
              />
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value as 'easy' | 'medium' | 'hard')}
                className="h-10 w-28 rounded-lg border border-stone-200 bg-white px-2 text-sm text-stone-900 outline-none dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100"
                disabled={generating}
              >
                <option value="easy">🟢 Easy</option>
                <option value="medium">🟡 Medium</option>
                <option value="hard">🔴 Hard</option>
              </select>
              <button
                onClick={generatePassage}
                disabled={generating || !aiTopic.trim()}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {generating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Generate</>
                )}
              </button>
            </div>
            {genError && <p className="mt-2 text-xs text-rose-500">{genError}</p>}
          </div>
        </div>
      </div>

      {/* Passage selector */}
      <div className="flex flex-wrap gap-1.5">
        {allPassages.map((p, i) => (
          <button
            key={p.id}
            onClick={() => changePassage(i)}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              i === passageIndex
                ? 'bg-stone-900 text-white shadow-sm dark:bg-white dark:text-stone-900'
                : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-white hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50 dark:hover:text-stone-300'
            }`}
          >
            {p.difficulty === 'easy' ? '🟢' : p.difficulty === 'medium' ? '🟡' : '🔴'} {p.title}
          </button>
        ))}
      </div>

      {!started ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/40">
          <BookText className="mx-auto h-10 w-10 text-stone-300 dark:text-stone-600" />
          <h3 className="mt-4 font-serif text-xl font-bold tracking-tight text-stone-900 dark:text-white">{passage.title}</h3>
          <p className="mt-1.5 text-sm text-stone-400 dark:text-stone-500">
            {passage.wordCount} words &middot; {passage.questions.length} questions &middot; {passage.difficulty} difficulty &middot; 20 minutes
          </p>
          <button
            onClick={startPassage}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            <Play className="h-4 w-4" />
            Start Reading
          </button>
        </div>
      ) : (
        <>
          {/* Timer + controls */}
          <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
              <Timer className="h-4 w-4" />
              <TimerDisplay seconds={timer.seconds} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => timer.running ? timer.pause() : timer.start()}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-300"
              >
                {timer.running ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={handleSubmit}
                disabled={Object.keys(answers).length === 0}
                className="rounded-lg bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                Submit Answers
              </button>
            </div>
          </div>

          {/* Answer Navigation Grid */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">Question Navigator</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {questions.map((q, i) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                const isCorrect = isAnswerCorrect(q, answers[q.id]);
                
                let btnStyle = "border-stone-200 text-stone-400 hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:text-stone-500 dark:hover:border-stone-600 dark:hover:text-stone-300";
                if (showResults) {
                  if (isCorrect) {
                    btnStyle = "bg-orange-500 border-orange-500 text-white shadow-sm";
                  } else if (isAnswered) {
                    btnStyle = "bg-rose-500 border-rose-500 text-white shadow-sm";
                  } else {
                    btnStyle = "bg-amber-400 border-amber-400 text-white shadow-sm";
                  }
                } else if (isAnswered) {
                  btnStyle = "border-stone-900 bg-stone-900 text-white dark:border-white dark:bg-white dark:text-stone-900";
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => {
                      document.getElementById(`q-container-${q.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={`flex h-7 w-7 items-center justify-center rounded-lg border text-[11px] font-semibold transition-all hover:scale-105 active:scale-95 ${btnStyle}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Passage + Questions side by side */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="max-h-[600px] overflow-y-auto rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
              <p className="font-serif text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">Reading Passage</p>
              <div className="mt-3 space-y-3">
                {passage.text.split('\n\n').map((p, i) => (
                  <p key={i} className="text-sm leading-7 text-stone-700 dark:text-stone-300">{p.trim()}</p>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {questions.map((q, i) => {
                const isAnswered = answers[q.id] !== undefined && answers[q.id] !== '';
                const isCorrect = isAnswerCorrect(q, answers[q.id]);

                return (
                  <div key={q.id} id={`q-container-${q.id}`} className={`rounded-xl border p-4 shadow-sm scroll-mt-20 transition-all ${
                    showResults
                      ? isCorrect
                        ? 'border-orange-200 bg-orange-50/30 dark:border-orange-800/30 dark:bg-orange-950/10'
                        : isAnswered
                          ? 'border-rose-200 bg-rose-50/30 dark:border-rose-800/30 dark:bg-rose-950/10'
                          : 'border-stone-200 bg-white dark:border-stone-700/50 dark:bg-stone-900/60'
                      : 'border-stone-200 bg-white dark:border-stone-700/50 dark:bg-stone-900/60'
                  }`}>
                    <div className="flex items-start gap-3">
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                        showResults
                          ? isCorrect
                            ? 'bg-orange-500 text-white'
                            : isAnswered
                              ? 'bg-rose-500 text-white'
                              : 'bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
                          : 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                      }`}>
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                          {q.type === 'mcq' && 'Multiple Choice'}
                          {q.type === 'tfng' && 'True / False / Not Given'}
                          {q.type === 'heading' && 'Matching Headings'}
                          {q.type === 'completion' && 'Sentence Completion'}
                        </p>
                        <p className="mt-1 text-sm font-medium text-stone-800 dark:text-stone-200">{q.question}</p>

                        {q.type === 'mcq' && q.options && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt) => {
                              const isSelected = answers[q.id] === opt;
                              const isOptCorrect = opt === q.answer;
                              const optStyle = showResults
                                ? isSelected
                                  ? isOptCorrect
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold dark:border-orange-500 dark:bg-orange-950/20 dark:text-orange-400'
                                    : 'border-rose-500 bg-rose-50 text-rose-700 font-semibold dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
                                  : isOptCorrect
                                    ? 'border-orange-400/50 bg-orange-50/50 text-orange-700 font-semibold dark:border-orange-600/30 dark:bg-orange-950/10 dark:text-orange-400'
                                    : 'border-stone-100 opacity-50 pointer-events-none dark:border-stone-700/30'
                                : isSelected
                                  ? 'border-stone-900 bg-stone-50 text-stone-900 dark:border-white dark:bg-stone-800 dark:text-white'
                                  : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50';

                              return (
                                <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${optStyle}`}>
                                  <input
                                    type="radio"
                                    name={`q-${q.id}`}
                                    value={opt}
                                    checked={isSelected}
                                    onChange={() => handleAnswer(q.id, opt)}
                                    className="sr-only"
                                    disabled={showResults}
                                  />
                                  {showResults && isOptCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                                  {showResults && isSelected && !isOptCorrect && <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                                  {!showResults && (
                                    <div className={`h-3 w-3 shrink-0 rounded-full border-2 ${
                                      isSelected ? 'border-stone-900 bg-stone-900 dark:border-white dark:bg-white' : 'border-stone-300 dark:border-stone-600'
                                    }`} />
                                  )}
                                  {opt}
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'tfng' && (
                          <div className="mt-2 flex gap-1.5">
                            {['True', 'False', 'Not Given'].map((opt) => {
                              const isSelected = answers[q.id] === opt;
                              const isOptCorrect = opt === q.answer;
                              const btnStyle = showResults
                                ? isSelected
                                  ? isOptCorrect
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold dark:border-orange-500 dark:bg-orange-950/20 dark:text-orange-400'
                                    : 'border-rose-500 bg-rose-50 text-rose-700 font-semibold dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
                                  : isOptCorrect
                                    ? 'border-orange-400/50 bg-orange-50/50 text-orange-700 font-semibold dark:border-orange-600/30 dark:bg-orange-950/10 dark:text-orange-400'
                                    : 'border-stone-100 opacity-50 pointer-events-none dark:border-stone-700/30'
                                : isSelected
                                  ? 'border-stone-900 bg-stone-50 text-stone-900 dark:border-white dark:bg-stone-800 dark:text-white'
                                  : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50';

                              return (
                                <button
                                  key={opt}
                                  onClick={() => !showResults && handleAnswer(q.id, opt)}
                                  disabled={showResults}
                                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all flex items-center gap-1 ${btnStyle}`}
                                >
                                  {showResults && isOptCorrect && <CheckCircle2 className="h-3 w-3 text-orange-500 shrink-0" />}
                                  {showResults && isSelected && !isOptCorrect && <XCircle className="h-3 w-3 text-rose-500 shrink-0" />}
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'heading' && q.options && (
                          <div className="mt-2 space-y-1">
                            {q.options.map((opt) => {
                              const isSelected = answers[q.id] === opt;
                              const isOptCorrect = opt === q.answer;
                              const optStyle = showResults
                                ? isSelected
                                  ? isOptCorrect
                                    ? 'border-orange-500 bg-orange-50 text-orange-700 font-semibold dark:border-orange-500 dark:bg-orange-950/20 dark:text-orange-400'
                                    : 'border-rose-500 bg-rose-50 text-rose-700 font-semibold dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
                                  : isOptCorrect
                                    ? 'border-orange-400/50 bg-orange-50/50 text-orange-700 font-semibold dark:border-orange-600/30 dark:bg-orange-950/10 dark:text-orange-400'
                                    : 'border-stone-100 opacity-50 pointer-events-none dark:border-stone-700/30'
                                : isSelected
                                  ? 'border-stone-900 bg-stone-50 text-stone-900 dark:border-white dark:bg-stone-800 dark:text-white'
                                  : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50';

                              return (
                                <label key={opt} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs transition-all ${optStyle}`}>
                                  <input
                                    type="radio"
                                    name={`q-${q.id}`}
                                    value={opt}
                                    checked={isSelected}
                                    onChange={() => handleAnswer(q.id, opt)}
                                    className="sr-only"
                                    disabled={showResults}
                                  />
                                  {showResults && isOptCorrect && <CheckCircle2 className="h-3.5 w-3.5 text-orange-500 shrink-0" />}
                                  {showResults && isSelected && !isOptCorrect && <XCircle className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                                  {opt}
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {q.type === 'completion' && (
                          <input
                            type="text"
                            value={answers[q.id] || ''}
                            onChange={(e) => handleAnswer(q.id, e.target.value)}
                            disabled={showResults}
                            placeholder="Type your answer..."
                            className={`mt-2 w-full rounded-lg border bg-white px-3 py-2 text-sm text-stone-900 outline-none transition-all disabled:opacity-50 dark:bg-stone-800 dark:text-stone-100 ${
                              showResults && isCorrect
                                ? 'border-orange-500 ring-2 ring-orange-500/15'
                                : showResults && isAnswered
                                  ? 'border-rose-500 ring-2 ring-rose-500/15'
                                  : 'border-stone-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700'
                            }`}
                          />
                        )}

                        {showResults && !isCorrect && (
                          <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 dark:border-amber-800/30 dark:bg-amber-950/10">
                            <Lightbulb className="h-3.5 w-3.5 shrink-0 text-amber-500 mt-0.5" />
                            <div>
                              {isAnswered ? (
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                  Correct answer: <span className="font-bold">{q.answer}</span>
                                </p>
                              ) : (
                                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                  <span className="font-bold">No answer</span> — correct answer: {q.answer}
                                </p>
                              )}
                              <p className="mt-0.5 text-[10px] text-amber-600/70 dark:text-amber-500/70">{q.explanation}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {showResults && (
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
              <div className="flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-stone-900 dark:bg-white">
                  <GraduationCap className="h-8 w-8 text-white dark:text-stone-900" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg font-bold tracking-tight text-stone-900 dark:text-white">Practice Complete</h3>
                  <p className="mt-1 text-sm text-stone-400 dark:text-stone-500">
                    You scored <span className="font-bold text-orange-600 dark:text-orange-400">{score}/{questions.length}</span>
                    {' · '}Estimated Band: <span className="font-bold text-orange-600 dark:text-orange-400">{band}.0</span>
                  </p>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-stone-400 dark:text-stone-500">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3 text-orange-500" />
                      {questions.filter((q) => isAnswerCorrect(q, answers[q.id])).length} correct
                    </span>
                    <span className="flex items-center gap-1">
                      <XCircle className="h-3 w-3 text-rose-500" />
                      {questions.filter((q) => answers[q.id] !== undefined && answers[q.id] !== '' && !isAnswerCorrect(q, answers[q.id])).length} incorrect
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 text-amber-500" />
                      {questions.filter((q) => !answers[q.id]).length} unanswered
                    </span>
                  </div>
                </div>
                <button
                  onClick={startPassage}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                >
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// WRITING GRAPHICS
// ═══════════════════════════════════════════════════════════════

function WritingTaskGraphic({ taskId }: { taskId: string }) {
  if (taskId === 'writing-task1-1') {
    // Line Graph SVG
    // Renewable energy consumption in 5 countries: 2000 to 2020
    // Country A (5% to 45%), B (8% to 35%), C (3% to 25%), D (12% to 30%), E (2% to 50%)
    return (
      <div className="mt-4 rounded-xl border bg-white p-4 dark:bg-stone-900/50">
        <p className="text-center text-xs font-bold text-stone-800 dark:text-stone-200 mb-2">
          Renewable Energy Consumption (% of total energy)
        </p>
        <svg viewBox="0 0 500 300" className="w-full h-auto">
          {/* Grid lines */}
          <line x1="50" y1="50" x2="450" y2="50" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="100" x2="450" y2="100" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="150" x2="450" y2="150" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="200" x2="450" y2="200" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="250" x2="450" y2="250" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="50" y1="250" x2="50" y2="30" stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Y Axis labels (0% to 50%) */}
          <text x="40" y="254" className="text-[10px] text-stone-500 fill-current text-right">0%</text>
          <text x="40" y="204" className="text-[10px] text-stone-500 fill-current text-right">10%</text>
          <text x="40" y="154" className="text-[10px] text-stone-500 fill-current text-right">20%</text>
          <text x="40" y="104" className="text-[10px] text-stone-500 fill-current text-right">30%</text>
          <text x="40" y="54" className="text-[10px] text-stone-500 fill-current text-right">40%</text>
          <text x="40" y="34" className="text-[10px] text-stone-500 fill-current text-right">50%</text>

          {/* X Axis labels (2000, 2005, 2010, 2015, 2020) */}
          <text x="50" y="270" className="text-[10px] text-stone-500 fill-current text-center" textAnchor="middle">2000</text>
          <text x="150" y="270" className="text-[10px] text-stone-500 fill-current text-center" textAnchor="middle">2005</text>
          <text x="250" y="270" className="text-[10px] text-stone-500 fill-current text-center" textAnchor="middle">2010</text>
          <text x="350" y="270" className="text-[10px] text-stone-500 fill-current text-center" textAnchor="middle">2015</text>
          <text x="450" y="270" className="text-[10px] text-stone-500 fill-current text-center" textAnchor="middle">2020</text>

          {/* Country Lines */}
          {/* Country A: Red */}
          <path d="M 50 225 L 150 190 L 250 150 L 350 90 L 450 25" fill="none" stroke="#ef4444" strokeWidth="2.5" />
          <circle cx="50" cy="225" r="4" className="fill-red-500" />
          <circle cx="150" cy="190" r="4" className="fill-red-500" />
          <circle cx="250" cy="150" r="4" className="fill-red-500" />
          <circle cx="350" cy="90" r="4" className="fill-red-500" />
          <circle cx="450" cy="25" r="4" className="fill-red-500" />

          {/* Country B: Blue */}
          <path d="M 50 210 L 150 175 L 250 140 L 350 110 L 450 75" fill="none" stroke="#3b82f6" strokeWidth="2.5" />
          <circle cx="50" cy="210" r="4" className="fill-blue-500" />
          <circle cx="150" cy="175" r="4" className="fill-blue-500" />
          <circle cx="250" cy="140" r="4" className="fill-blue-500" />
          <circle cx="350" cy="110" r="4" className="fill-blue-500" />
          <circle cx="450" cy="75" r="4" className="fill-blue-500" />

          {/* Country C: Emerald */}
          <path d="M 50 235 L 150 210 L 250 185 L 350 160 L 450 125" fill="none" stroke="#10b981" strokeWidth="2.5" />
          <circle cx="50" cy="235" r="4" className="fill-emerald-500" />
          <circle cx="150" cy="210" r="4" className="fill-emerald-500" />
          <circle cx="250" cy="185" r="4" className="fill-emerald-500" />
          <circle cx="350" cy="160" r="4" className="fill-emerald-500" />
          <circle cx="450" cy="125" r="4" className="fill-emerald-500" />

          {/* Country D: Amber */}
          <path d="M 50 190 L 150 170 L 250 150 L 350 130 L 450 100" fill="none" stroke="#f59e0b" strokeWidth="2.5" />
          <circle cx="50" cy="190" r="4" className="fill-amber-500" />
          <circle cx="150" cy="170" r="4" className="fill-amber-500" />
          <circle cx="250" cy="150" r="4" className="fill-amber-500" />
          <circle cx="350" cy="130" r="4" className="fill-amber-500" />
          <circle cx="450" cy="100" r="4" className="fill-amber-500" />

          {/* Country E: Violet */}
          <path d="M 50 240 L 150 200 L 250 140 L 350 75 L 450 0" fill="none" stroke="#8b5cf6" strokeWidth="2.5" />
          <circle cx="50" cy="240" r="4" className="fill-violet-500" />
          <circle cx="150" cy="200" r="4" className="fill-violet-500" />
          <circle cx="250" cy="140" r="4" className="fill-violet-500" />
          <circle cx="350" cy="75" r="4" className="fill-violet-500" />
          <circle cx="450" cy="0" r="4" className="fill-violet-500" />
        </svg>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap justify-center gap-4 text-[10px] font-semibold text-stone-700 dark:text-stone-300">
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-red-500 rounded" /> Country A</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-blue-500 rounded" /> Country B</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-emerald-500 rounded" /> Country C</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-amber-500 rounded" /> Country D</span>
          <span className="flex items-center gap-1"><span className="h-2 w-4 bg-violet-500 rounded" /> Country E</span>
        </div>
      </div>
    );
  }

  if (taskId === 'writing-task1-2') {
    // Grouped Bar Chart SVG
    const categories = [
      { name: 'TV', v10: 120, v20: 75 },
      { name: 'Social Media', v10: 45, v20: 120 },
      { name: 'Gaming', v10: 60, v20: 85 },
      { name: 'Reading', v10: 30, v20: 25 },
      { name: 'Music', v10: 20, v20: 65 },
      { name: 'Podcasts', v10: 5, v20: 30 },
    ];
    return (
      <div className="mt-4 rounded-xl border bg-white p-4 dark:bg-stone-900/50">
        <p className="text-center text-xs font-bold text-stone-800 dark:text-stone-200 mb-2">
          Media Time Spent by UK Teenagers (minutes per day)
        </p>
        <svg viewBox="0 0 500 300" className="w-full h-auto">
          {/* Grid lines */}
          <line x1="50" y1="50" x2="450" y2="50" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="100" x2="450" y2="100" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="150" x2="450" y2="150" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="200" x2="450" y2="200" stroke="#e2e8f0" strokeDasharray="3" />
          <line x1="50" y1="250" x2="450" y2="250" stroke="#cbd5e1" strokeWidth="1.5" />
          <line x1="50" y1="250" x2="50" y2="30" stroke="#cbd5e1" strokeWidth="1.5" />

          {/* Y Axis labels */}
          <text x="40" y="254" className="text-[10px] text-stone-500 fill-current text-right">0</text>
          <text x="40" y="200" className="text-[10px] text-stone-500 fill-current text-right">30</text>
          <text x="40" y="150" className="text-[10px] text-stone-500 fill-current text-right">60</text>
          <text x="40" y="100" className="text-[10px] text-stone-500 fill-current text-right">90</text>
          <text x="40" y="50" className="text-[10px] text-stone-500 fill-current text-right">120</text>

          {/* Grouped bars */}
          {categories.map((cat, idx) => {
            const xGroup = 50 + idx * 66 + 10;
            const barWidth = 20;
            const h10 = cat.v10 * 1.66;
            const h20 = cat.v20 * 1.66;
            const y10 = 250 - h10;
            const y20 = 250 - h20;

            return (
              <g key={cat.name}>
                <rect x={xGroup} y={y10} width={barWidth} height={h10} fill="#f59e0b" rx="2" />
                <rect x={xGroup + barWidth + 4} y={y20} width={barWidth} height={h20} fill="#6366f1" rx="2" />
                <text
                  x={xGroup + barWidth + 2}
                  y="270"
                  className="text-[9px] text-stone-600 dark:text-stone-400 fill-current text-center font-medium"
                  textAnchor="middle"
                >
                  {cat.name}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div className="mt-3 flex justify-center gap-6 text-[10px] font-semibold text-stone-700 dark:text-stone-300">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-amber-500 rounded" /> 2010</span>
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 bg-indigo-500 rounded" /> 2020</span>
        </div>
      </div>
    );
  }

  if (taskId === 'writing-task1-3') {
    // Process Flow Diagram
    const steps = [
      { num: 1, text: 'Spring Water' },
      { num: 2, text: 'Pumping' },
      { num: 3, text: 'Carbon Filter' },
      { num: 4, text: 'Ozonation' },
      { num: 5, text: 'Filling' },
      { num: 6, text: 'Sealing' },
      { num: 7, text: 'Labelling' },
      { num: 8, text: 'Packing' },
      { num: 9, text: 'Transport' },
      { num: 10, text: 'Retail Shop' },
    ];
    return (
      <div className="mt-4 rounded-xl border bg-white p-4 dark:bg-stone-900/50">
        <p className="text-center text-xs font-bold text-stone-800 dark:text-stone-200 mb-4">
          Commercial Bottled Water Production Process Flow
        </p>
        
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {steps.map((step, idx) => (
            <div key={step.num} className="relative flex flex-col items-center justify-between rounded-xl border border-stone-200 bg-white p-3 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/40">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white mb-2">
                {step.num}
              </div>
              <p className="text-[11px] font-bold text-stone-700 dark:text-stone-300 leading-tight">
                {step.text}
              </p>
              {idx < steps.length - 1 && (
                <div className="hidden sm:block absolute top-1/2 -right-2 -translate-y-1/2 z-10 text-orange-500 font-bold text-sm">
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// WRITING MODULE
// ═══════════════════════════════════════════════════════════════

function WritingModule() {
  const [taskIndex, setTaskIndex] = useState(0)
  const [started, setStarted] = useState(false)
  const [content, setContent] = useState('')
  const [showChecklist, setShowChecklist] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [evaluation, setEvaluation] = useState<any | null>(null)
  
  const timer = useTimer(WRITING_TASKS[taskIndex].timeMinutes * 60, () => {})

  const task = WRITING_TASKS[taskIndex]
  const wordCount = content.split(/\s+/).filter(Boolean).length
  const targetMin = task.type === 'task1' ? 150 : 250
  const targetMax = task.type === 'task1' ? 200 : 300

  const startTask = () => {
    setContent('')
    setShowChecklist(false)
    setEvaluation(null)
    setEvalError('')
    timer.reset(task.timeMinutes * 60)
    timer.start()
    setStarted(true)
  }

  const evaluateEssay = async () => {
    if (!content.trim()) return
    setEvaluating(true)
    setEvalError('')
    setEvaluation(null)
    try {
      const res = await authFetch('/api/ielts/evaluate-writing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskType: task.type,
          title: task.title,
          prompt: task.prompt,
          content: content.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to evaluate essay')
      }
      const data = await res.json()
      setEvaluation(data)
      timer.pause()
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setEvaluating(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Task type selector */}
      <div className="flex flex-wrap gap-1.5">
        <span className="self-center mr-1 text-[11px] font-semibold text-stone-400 dark:text-stone-500">Academic Writing:</span>
        {WRITING_TASKS.map((t, i) => (
          <button
            key={t.id}
            onClick={() => { setTaskIndex(i); setStarted(false); setEvaluation(null); setEvalError(''); timer.reset(t.timeMinutes * 60) }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              i === taskIndex
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-white hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50 dark:hover:text-stone-300'
            }`}
          >
            {t.type === 'task1' ? '📊 ' : '📝 '}{t.title}
          </button>
        ))}
      </div>

      {!started ? (
        <div className="rounded-xl border border-stone-200 bg-white p-10 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/40">
          <PenLine className="mx-auto h-10 w-10 text-stone-300 dark:text-stone-600" />
          <h3 className="mt-4 font-serif text-xl font-bold tracking-tight text-stone-900 dark:text-white">{task.title}</h3>
          <p className="mt-1.5 text-sm text-stone-400 dark:text-stone-500">
            {task.timeMinutes} minutes &middot; {task.type === 'task1' ? '150 words minimum' : '250 words minimum'}
          </p>
          <div className="mt-5 text-left max-w-lg mx-auto space-y-2">
            {task.tips.map((tip, i) => (
              <p key={i} className="flex items-start gap-2 text-xs text-stone-500 dark:text-stone-400">
                <span className="mt-0.5 text-stone-300 dark:text-stone-600">•</span>
                {tip}
              </p>
            ))}
          </div>
          <button
            onClick={startTask}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
          >
            <Play className="h-4 w-4" />
            Start Writing
          </button>
        </div>
      ) : (
        <>
          {/* Timer + toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-stone-500 dark:text-stone-400">
                <Timer className="h-4 w-4" />
                <TimerDisplay seconds={timer.seconds} />
              </div>
              <div className="h-4 w-px bg-stone-200 dark:bg-stone-700" />
              <div className={`text-xs font-semibold ${
                wordCount < targetMin ? 'text-rose-500' : wordCount <= targetMax ? 'text-orange-500' : 'text-amber-500'
              }`}>
                {wordCount} words
                {wordCount < targetMin ? ` (min ${targetMin})` : ''}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => timer.running ? timer.pause() : timer.start()}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-500 transition-colors hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-300"
              >
                {timer.running ? 'Pause' : 'Resume'}
              </button>
              <button
                onClick={() => setShowChecklist(!showChecklist)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  showChecklist ? 'border-stone-900 bg-stone-900 text-white dark:border-white dark:bg-white dark:text-stone-900' : 'border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:text-stone-300'
                }`}
              >
                <ListChecks className="inline h-3 w-3 mr-1" />
                Checklist
              </button>
              <button
                onClick={evaluateEssay}
                disabled={evaluating || !content.trim()}
                className="rounded-lg bg-stone-900 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] disabled:opacity-40 flex items-center gap-1.5 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {evaluating ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Evaluating...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5" /> Evaluate Essay</>
                )}
              </button>
            </div>
          </div>

          {evalError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
              {evalError}
            </div>
          )}

          {/* Prompt + editor */}
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
              <p className="font-serif text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">Task Prompt</p>
              <p className="mt-3 text-sm leading-7 text-stone-700 whitespace-pre-line dark:text-stone-300">{task.prompt}</p>
              <WritingTaskGraphic taskId={task.id} />
            </div>

            <div className="space-y-3">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your response here..."
                className="h-[400px] w-full resize-none rounded-xl border border-stone-200 bg-white p-4 text-sm leading-7 text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
              />
            </div>
          </div>

          {/* Checklist */}
          {showChecklist && (
            <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 dark:border-stone-700/50 dark:bg-stone-900/40">
              <h4 className="font-serif text-xs font-bold tracking-tight text-stone-700 dark:text-stone-300">Writing Checklist</h4>
              <div className="mt-2 grid gap-2 text-xs text-stone-500 dark:text-stone-400 sm:grid-cols-2">
                {task.type === 'task1' ? (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Overview sentence included</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Specific figures mentioned</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Comparisons made where relevant</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Appropriate tense used</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> No personal opinions or explanations</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Minimum 150 words reached</label>
                  </>
                ) : (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Clear introduction paraphrasing the question</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Position stated clearly</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Each paragraph has one main idea</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Specific examples used for support</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Cohesive devices used (however, moreover, etc.)</label>
                    <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" className="rounded border-stone-300 dark:border-stone-600" /> Minimum 250 words reached</label>
                  </>
                )}
              </div>
            </div>
          )}

          {timer.seconds === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 text-center dark:border-amber-800/30 dark:bg-amber-950/10">
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Time is up! Review your response and check the checklist above.
              </p>
            </div>
          )}

          {/* Evaluation Results */}
          {evaluation && (
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60 mt-5 space-y-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* Score card */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm w-full md:w-48 shrink-0 dark:border-stone-700 dark:bg-stone-800">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">Overall Band</span>
                  <div className="mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-900 text-2xl font-black text-white shadow-sm dark:bg-white dark:text-stone-900">
                    {evaluation.overallBand.toFixed(1)}
                  </div>
                  <span className="mt-2 text-[10px] font-semibold text-stone-400 dark:text-stone-500">Estimated Band Score</span>
                </div>

                {/* Criteria breakdown */}
                <div className="flex-1 space-y-3">
                  <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Criteria Breakdown</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      { key: 'taskAchievement', label: task.type === 'task1' ? 'Task Achievement' : 'Task Response', score: evaluation.scores.taskAchievement },
                      { key: 'coherenceCohesion', label: 'Coherence & Cohesion', score: evaluation.scores.coherenceCohesion },
                      { key: 'lexicalResource', label: 'Lexical Resource', score: evaluation.scores.lexicalResource },
                      { key: 'grammarAccuracy', label: 'Grammatical Range & Accuracy', score: evaluation.scores.grammarAccuracy },
                    ].map((item) => (
                      <div key={item.key} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-stone-500 dark:text-stone-400">{item.label}</span>
                          <span className="text-stone-900 dark:text-white">Band {item.score.toFixed(1)}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
                          <div
                            className="h-full rounded-full bg-stone-900 dark:bg-white transition-all"
                            style={{ width: `${(item.score / 9) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detailed criteria reviews */}
              <div className="space-y-3">
                <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Detailed Examiner Comments</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { label: task.type === 'task1' ? 'Task Achievement' : 'Task Response', content: evaluation.criteriaAnalysis.taskAchievement },
                    { label: 'Coherence & Cohesion', content: evaluation.criteriaAnalysis.coherenceCohesion },
                    { label: 'Lexical Resource', content: evaluation.criteriaAnalysis.lexicalResource },
                    { label: 'Grammatical Range & Accuracy', content: evaluation.criteriaAnalysis.grammarAccuracy },
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
                      <h5 className="font-serif text-[11px] font-bold tracking-tight text-stone-700 dark:text-stone-300 mb-1">{item.label}</h5>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-5">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grammar & vocabulary corrections */}
              {evaluation.corrections && evaluation.corrections.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Suggested Edits &amp; Corrections</h4>
                  <div className="space-y-2">
                    {evaluation.corrections.map((corr: any, idx: number) => (
                      <div key={idx} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
                        <div className="flex flex-wrap items-center gap-1.5 text-xs">
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 line-through dark:bg-rose-950/40 dark:text-rose-400">
                            {corr.original}
                          </span>
                          <ChevronRight className="h-3 w-3 text-stone-400" />
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                            {corr.corrected}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] italic text-stone-400 dark:text-stone-500">{corr.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Model essay comparison */}
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Your Response</h4>
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm text-xs leading-6 text-stone-600 whitespace-pre-line max-h-80 overflow-y-auto dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-400">
                    {content}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Band 8.5+ Model Response</h4>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">Exemplar</span>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 shadow-sm text-xs leading-6 text-stone-700 whitespace-pre-line max-h-80 overflow-y-auto dark:border-stone-700 dark:bg-stone-800/30 dark:text-stone-300">
                    {evaluation.improvedText}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// SPEAKING MODULE
// ═══════════════════════════════════════════════════════════════

function SpeakingModule() {
  const [allSpeakingCards, setAllSpeakingCards] = useState<CueCard[]>([...SPEAKING_CARDS])
  const [currentCardIndex, setCurrentCardIndex] = useState(0)
  const [phase, setPhase] = useState<'select' | 'prep' | 'speak' | 'done'>('select')
  const [filterPart, setFilterPart] = useState<1 | 2 | 3>(1)

  // Custom generator states
  const [aiTopic, setAiTopic] = useState('')
  const [generatingCard, setGeneratingCard] = useState(false)
  const [genErrorCard, setGenErrorCard] = useState('')

  const partCards = allSpeakingCards.filter((c) => c.part === filterPart)
  const currentCard = partCards[currentCardIndex]

  const prepTimer = useTimer(currentCard?.prepTime || 30, () => {})
  const speakTimer = useTimer(currentCard?.speakTime || 120, () => {})

  // Audio recording states
  const [isRecording, setIsRecording] = useState(false)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  
  // Speech transcription states
  const [transcript, setTranscript] = useState('')
  const [recognition, setRecognition] = useState<any | null>(null)

  // AI Evaluation states
  const [evaluating, setEvaluating] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [evaluation, setEvaluation] = useState<any | null>(null)

  // Initialize Speech Recognition
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      if (SpeechRecognition) {
        const rec = new SpeechRecognition()
        rec.continuous = true
        rec.interimResults = true
        rec.lang = 'en-US'
        
        rec.onresult = (event: any) => {
          let finalTranscript = ''
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript + ' '
            }
          }
          if (finalTranscript) {
            setTranscript((prev) => prev + finalTranscript)
          }
        }
        
        rec.onerror = (event: any) => {
          console.error("Speech recognition error:", event.error)
        }
        
        setRecognition(rec)
      }
    }
  }, [])

  const startPrep = () => {
    setAudioUrl(null)
    setTranscript('')
    setEvaluation(null)
    setEvalError('')
    setPhase('prep')
    prepTimer.reset(currentCard?.prepTime || 30)
    prepTimer.start()
  }

  const startSpeak = () => {
    prepTimer.pause()
    setPhase('speak')
    speakTimer.reset(currentCard?.speakTime || 120)
    speakTimer.start()
  }

  const finishCard = () => {
    speakTimer.pause()
    if (isRecording) {
      stopRecording()
    }
    setPhase('done')
  }

  const nextCard = () => {
    if (currentCardIndex < partCards.length - 1) {
      setCurrentCardIndex(currentCardIndex + 1)
    } else {
      setCurrentCardIndex(0)
    }
    setPhase('select')
    setAudioUrl(null)
    setTranscript('')
    setEvaluation(null)
    setEvalError('')
    prepTimer.reset(currentCard?.prepTime || 30)
    speakTimer.reset(currentCard?.speakTime || 120)
  }

  const startRecording = async () => {
    setAudioUrl(null)
    setTranscript('')
    setEvaluation(null)
    setEvalError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      const chunks: Blob[] = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data)
      }

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
      }

      recorder.start()
      setMediaRecorder(recorder)
      setIsRecording(true)

      if (recognition) {
        try {
          recognition.start()
        } catch (e) {
          console.warn("Speech recognition already started or failed to start:", e)
        }
      }
    } catch (err) {
      console.error("Microphone access denied or error:", err)
      setEvalError("Could not access microphone. Please check permissions.")
    }
  }

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop()
      mediaRecorder.stream.getTracks().forEach((track) => track.stop())
      setIsRecording(false)
    }
    if (recognition) {
      try {
        recognition.stop()
      } catch (e) {
        console.warn("Speech recognition failed to stop:", e)
      }
    }
  }

  const evaluateSpeaking = async () => {
    if (!transcript.trim()) return
    setEvaluating(true)
    setEvalError('')
    setEvaluation(null)
    try {
      const res = await authFetch('/api/ielts/evaluate-speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentCard.question,
          transcript: transcript.trim(),
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to evaluate speaking')
      }
      const data = await res.json()
      setEvaluation(data)
    } catch (e) {
      setEvalError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setEvaluating(false)
    }
  }

  const generateSpeakingCard = async () => {
    if (!aiTopic.trim()) return
    setGeneratingCard(true)
    setGenErrorCard('')
    try {
      const res = await authFetch('/api/ielts/generate-speaking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate speaking card')
      }
      const data = await res.json()
      const newCard: CueCard = {
        id: `ai-${Date.now()}`,
        part: data.part || 2,
        question: data.question,
        followUp: data.followUp,
        prepTime: data.prepTime,
        speakTime: data.speakTime,
      }
      setFilterPart(2)
      setAllSpeakingCards((prev) => [...prev, newCard])
      
      const newPartCards = [...allSpeakingCards, newCard].filter((c) => c.part === 2)
      setCurrentCardIndex(newPartCards.length - 1)
      setAiTopic('')
      setPhase('select')
    } catch (e) {
      setGenErrorCard(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGeneratingCard(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Part selector */}
      <div className="flex gap-1.5">
        {([1, 2, 3] as const).map((p) => (
          <button
            key={p}
            onClick={() => { setFilterPart(p); setCurrentCardIndex(0); setPhase('select'); setEvaluation(null); setAudioUrl(null); setTranscript('') }}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              filterPart === p
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-white hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50 dark:hover:text-stone-300'
            }`}
          >
            Part {p}
            {p === 1 ? ' (Intro)' : p === 2 ? ' (Cue Card)' : ' (Discussion)'}
          </button>
        ))}
      </div>

      {phase === 'select' && (
        <>
          {/* AI Speaking Card Generator */}
          <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 shadow-sm dark:bg-white">
                <Sparkles className="h-4 w-4 text-white dark:text-stone-900" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Generate IELTS Speaking Cue Card with AI</p>
                <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">Enter any topic — AI generates a Cue Card (Part 2) &amp; follow-ups (Part 3)</p>
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    value={aiTopic}
                    onChange={(e) => setAiTopic(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !generatingCard) generateSpeakingCard() }}
                    placeholder="e.g. A memorable journey, Dynamic cities, Climate change, Art..."
                    className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
                    disabled={generatingCard}
                  />
                  <button
                    onClick={generateSpeakingCard}
                    disabled={generatingCard || !aiTopic.trim()}
                    className="inline-flex h-10 items-center gap-2 rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                  >
                    {generatingCard ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" /> Generate</>
                    )}
                  </button>
                </div>
                {genErrorCard && <p className="mt-2 text-xs text-rose-500">{genErrorCard}</p>}
              </div>
            </div>
          </div>

          {/* Card list */}
          <div className="space-y-2">
            {partCards.map((card, i) => (
              <button
                key={card.id}
                onClick={() => { setCurrentCardIndex(i); startPrep() }}
                className={`w-full rounded-xl border p-4 text-left shadow-sm transition-all ${
                  i === currentCardIndex ? 'border-stone-900 bg-stone-50 dark:border-white dark:bg-stone-800' : 'border-stone-200 bg-white hover:border-stone-300 dark:border-stone-700/50 dark:bg-stone-900/40 dark:hover:border-stone-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
                    i === currentCardIndex ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900' : 'bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400'
                  }`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-stone-400 dark:text-stone-500">
                      {card.prepTime ? `${card.prepTime / 60} min prep · ${(card.speakTime || 120) / 60} min speak` : 'Discussion questions'}
                    </p>
                    <p className="mt-1 text-sm font-medium text-stone-700 dark:text-stone-300 line-clamp-2 whitespace-pre-line">{card.question}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-stone-300 dark:text-stone-600" />
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {(phase === 'prep' || phase === 'speak') && (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
          {/* Timer */}
          <div className="flex items-center justify-between border-b border-stone-200 pb-4 dark:border-stone-700">
            <div className="flex items-center gap-2">
              <span className="font-serif text-sm font-bold tracking-tight text-stone-900 dark:text-white">
                {phase === 'prep' ? 'Preparation Time' : 'Speaking Time'}
              </span>
              <TimerDisplay seconds={phase === 'prep' ? prepTimer.seconds : speakTimer.seconds} className="text-base" />
            </div>
            {phase === 'prep' && (
              <button
                onClick={startSpeak}
                className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                <Volume2 className="h-3.5 w-3.5" />
                Start Speaking
              </button>
            )}
            {phase === 'speak' && (
              <button
                onClick={finishCard}
                className="rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-500 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
              >
                Finish Test
              </button>
            )}
          </div>

          {/* Card content */}
          <div className="mt-5 rounded-lg border border-stone-200 bg-stone-50/50 p-5 dark:border-stone-700 dark:bg-stone-800/30">
            <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white mb-3">
              {currentCard?.part === 2 ? 'Cue Card' : 'Questions'}
            </h4>
            <p className="text-sm leading-7 text-stone-700 whitespace-pre-line dark:text-stone-300">{currentCard?.question}</p>
            {currentCard?.followUp && currentCard.followUp.length > 0 && (
              <div className="mt-4 border-t border-stone-200 pt-3 dark:border-stone-700">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-2">Follow-up questions (Part 3):</p>
                {currentCard.followUp.map((q, i) => (
                  <p key={i} className="text-xs text-stone-500 mt-1 dark:text-stone-400">• {q}</p>
                ))}
              </div>
            )}
          </div>

          {/* Recording & Speech-to-Text pane */}
          {phase === 'speak' && (
            <div className="mt-5 border-t border-stone-200 pt-5 space-y-4 dark:border-stone-700">
              <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white flex items-center gap-2">
                <Mic className="h-3.5 w-3.5" /> Speech Recording &amp; Transcription
              </h4>
              
              <div className="flex flex-wrap items-center gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecording}
                    className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                  >
                    <Play className="h-3.5 w-3.5" /> Record Response
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-rose-600 active:scale-[0.97]"
                  >
                    <div className="h-2 w-2 rounded-full bg-white animate-pulse" /> Stop Recording
                  </button>
                )}

                {audioUrl && (
                  <div className="flex-1 min-w-[200px]">
                    <audio src={audioUrl} controls className="w-full h-8" />
                  </div>
                )}
              </div>

              {evalError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
                  {evalError}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500">
                  Speech Transcript (Editable):
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Your transcription will appear here in real-time as you speak. You can edit the text directly if there are any mistakes."
                  className="h-28 w-full resize-none rounded-xl border border-stone-200 bg-white p-3.5 text-xs leading-5 text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div className="space-y-5">
          {!evaluation ? (
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
              <Mic className="mx-auto h-10 w-10 text-stone-300 dark:text-stone-600" />
              <h3 className="mt-4 font-serif text-lg font-bold tracking-tight text-stone-900 dark:text-white">Speaking Session Completed</h3>
              <p className="mt-1.5 text-sm text-stone-400 dark:text-stone-500 max-w-md mx-auto">
                {transcript.trim() 
                  ? "Your transcript is ready! Submit it for AI examiner feedback on vocabulary, grammar, and fluency."
                  : "Session finished. You did not record or type a transcript. You can retry the card or evaluate if you type one below."}
              </p>

              {audioUrl && (
                <div className="max-w-xs mx-auto mt-4">
                  <p className="text-[10px] font-semibold text-stone-400 mb-1">Recorded Response:</p>
                  <audio src={audioUrl} controls className="w-full h-8" />
                </div>
              )}

              <div className="max-w-xl mx-auto mt-5 space-y-2 text-left">
                <label className="text-[10px] font-semibold uppercase tracking-[0.08em] text-stone-400 dark:text-stone-500">
                  Speech Transcript:
                </label>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder="Type your spoken response here to evaluate..."
                  className="h-28 w-full resize-none rounded-xl border border-stone-200 bg-white p-3 text-xs leading-5 text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
                />
              </div>

              {evalError && (
                <div className="max-w-xl mx-auto mt-3 rounded-xl border border-rose-200 bg-rose-50/50 p-3 text-xs text-rose-600 dark:border-rose-800/30 dark:bg-rose-950/10 dark:text-rose-400">
                  {evalError}
                </div>
              )}

              <div className="flex justify-center gap-3 mt-6">
                <button
                  onClick={() => { setPhase('select'); prepTimer.reset(currentCard?.prepTime || 30); speakTimer.reset(currentCard?.speakTime || 120) }}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-500 hover:border-stone-300 hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try Again
                </button>
                <button
                  onClick={evaluateSpeaking}
                  disabled={evaluating || !transcript.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-stone-700 disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                >
                  {evaluating ? (
                    <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Evaluating...</>
                  ) : (
                    <><Sparkles className="h-3.5 w-3.5" /> Evaluate Speaking</>
                  )}
                </button>
              </div>
            </div>
          ) : (
            /* AI Speaking evaluation dashboard */
            <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60 space-y-6">
              <div className="flex flex-col gap-6 md:flex-row md:items-start">
                {/* Score card */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-stone-200 bg-white p-6 text-center shadow-sm w-full md:w-48 shrink-0 dark:border-stone-700 dark:bg-stone-800">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">Overall Band</span>
                  <div className="mt-4 flex h-20 w-20 items-center justify-center rounded-full bg-stone-900 text-2xl font-black text-white shadow-sm dark:bg-white dark:text-stone-900">
                    {evaluation.overallBand.toFixed(1)}
                  </div>
                  <span className="mt-2 text-[10px] font-semibold text-stone-400 dark:text-stone-500">Estimated Band Score</span>
                </div>

                {/* Criteria breakdown */}
                <div className="flex-1 space-y-3">
                  <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Criteria Breakdown</h4>
                  <div className="grid gap-2 sm:grid-cols-3">
                    {[
                      { key: 'fluencyCoherence', label: 'Fluency & Coherence', score: evaluation.scores.fluencyCoherence },
                      { key: 'lexicalResource', label: 'Lexical Resource', score: evaluation.scores.lexicalResource },
                      { key: 'grammarAccuracy', label: 'Grammar Range & Accuracy', score: evaluation.scores.grammarAccuracy },
                    ].map((item) => (
                      <div key={item.key} className="rounded-xl border border-stone-200 bg-white p-3 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-stone-500 dark:text-stone-400">{item.label}</span>
                          <span className="text-stone-900 dark:text-white">Band {item.score.toFixed(1)}</span>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
                          <div
                            className="h-full rounded-full bg-stone-900 dark:bg-white transition-all"
                            style={{ width: `${(item.score / 9) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Detailed criteria reviews */}
              <div className="space-y-3">
                <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Detailed Examiner Comments</h4>
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    { label: 'Fluency & Coherence', content: evaluation.analysis.fluencyCoherence },
                    { label: 'Lexical Resource', content: evaluation.analysis.lexicalResource },
                    { label: 'Grammar Range & Accuracy', content: evaluation.analysis.grammarAccuracy },
                  ].map((item, idx) => (
                    <div key={idx} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700 dark:bg-stone-800/50">
                      <h5 className="font-serif text-[11px] font-bold tracking-tight text-stone-700 dark:text-stone-300 mb-1">{item.label}</h5>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-5">{item.content}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggestions */}
              {evaluation.suggestions && evaluation.suggestions.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Vocabulary &amp; Delivery Suggestions</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {evaluation.suggestions.map((sug: string, idx: number) => (
                      <div key={idx} className="flex gap-2 rounded-xl border border-stone-200 bg-white p-3.5 shadow-sm text-xs text-stone-600 leading-5 items-start dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-400">
                        <Lightbulb className="h-4 w-4 text-stone-400 shrink-0 mt-0.5 dark:text-stone-500" />
                        <span>{sug}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Response Comparison */}
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Your Transcript</h4>
                  <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm text-xs leading-6 text-stone-600 whitespace-pre-line max-h-80 overflow-y-auto dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-400">
                    {transcript}
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Recommended Band 8.5+ Response</h4>
                    <span className="rounded bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">Exemplar</span>
                  </div>
                  <div className="rounded-xl border border-stone-200 bg-stone-50/50 p-4 shadow-sm text-xs leading-6 text-stone-700 whitespace-pre-line max-h-80 overflow-y-auto dark:border-stone-700 dark:bg-stone-800/30 dark:text-stone-300">
                    {evaluation.modelAnswer}
                  </div>
                </div>
              </div>

              {/* Footer controls */}
              <div className="flex justify-center gap-3 pt-4 border-t border-stone-200 dark:border-stone-700">
                <button
                  onClick={() => { setPhase('select'); setEvaluation(null); setAudioUrl(null); setTranscript('') }}
                  className="rounded-lg border border-stone-200 px-5 py-2.5 text-xs font-semibold text-stone-500 hover:border-stone-300 hover:text-stone-700 transition-all dark:border-stone-700 dark:text-stone-400 dark:hover:text-stone-300"
                >
                  Close &amp; Choose Another
                </button>
                <button
                  onClick={() => {
                    setEvaluation(null)
                    setAudioUrl(null)
                    setTranscript('')
                    startPrep()
                  }}
                  className="rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-stone-700 active:scale-[0.97] transition-all dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
                >
                  Retry This Card
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// VOCABULARY MODULE
// ═══════════════════════════════════════════════════════════════

function VocabModule() {
  const [allTopics, setAllTopics] = useState<VocabTopic[]>([...VOCAB_TOPICS])
  const [selectedTopic, setSelectedTopic] = useState(VOCAB_TOPICS[0].topic)
  const topic = allTopics.find((t) => t.topic === selectedTopic) || allTopics[0]
  const [shuffled, setShuffled] = useState<VocabItem[]>([])
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizAnswer, setQuizAnswer] = useState('')
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizOptions, setQuizOptions] = useState<string[]>([])

  // AI Generator states
  const [aiTopic, setAiTopic] = useState('')
  const [generatingVocab, setGeneratingVocab] = useState(false)
  const [genErrorVocab, setGenErrorVocab] = useState('')

  const generateVocabTopic = async () => {
    if (!aiTopic.trim()) return
    setGeneratingVocab(true)
    setGenErrorVocab('')
    try {
      const res = await authFetch('/api/ielts/generate-vocab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic.trim() }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to generate vocabulary list')
      }
      const data = await res.json()
      const newTopic: VocabTopic = {
        topic: data.topic || aiTopic.trim(),
        icon: data.icon || '🎓',
        items: (data.items || []).map((item: any) => ({
          word: item.word,
          definition: item.definition,
          example: item.example,
        })),
      }
      setAllTopics((prev) => [...prev, newTopic])
      setSelectedTopic(newTopic.topic)
      setShowQuiz(false)
      setAiTopic('')
    } catch (e) {
      setGenErrorVocab(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setGeneratingVocab(false)
    }
  }

  const generateAndSetOptions = (word: VocabItem, allItems: VocabItem[]) => {
    if (!word) return
    const correctDef = word.definition
    const otherDefs = allItems
      .map((i) => i.definition)
      .filter((d) => d !== correctDef)
    const distractors = shuffleArray(otherDefs).slice(0, 3)
    setQuizOptions(shuffleArray([correctDef, ...distractors]))
  }

  const startQuiz = () => {
    const shuf = shuffleArray(topic.items)
    setShuffled(shuf)
    setQuizIndex(0)
    setQuizAnswer('')
    setQuizRevealed(false)
    setShowQuiz(true)
    if (shuf.length > 0) {
      generateAndSetOptions(shuf[0], topic.items)
    }
  }

  const handleNextQuestion = () => {
    if (quizIndex < shuffled.length - 1) {
      const nextIndex = quizIndex + 1
      setQuizIndex(nextIndex)
      setQuizAnswer('')
      setQuizRevealed(false)
      generateAndSetOptions(shuffled[nextIndex], topic.items)
    } else {
      setShowQuiz(false)
    }
  }

  const currentQuizWord = shuffled[quizIndex]

  return (
    <div className="space-y-5">
      {/* AI Vocabulary Generator */}
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-stone-900 shadow-sm dark:bg-white">
            <Sparkles className="h-4 w-4 text-white dark:text-stone-900" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-serif text-xs font-bold tracking-tight text-stone-900 dark:text-white">Generate Custom Vocabulary List with AI</p>
            <p className="mt-0.5 text-[10px] text-stone-400 dark:text-stone-500">Enter any topic — AI generates 8 high-level Band 7–9 IELTS academic words with definitions and example sentences</p>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={aiTopic}
                onChange={(e) => setAiTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !generatingVocab) generateVocabTopic() }}
                placeholder="e.g. Climate Change, Legal Matters, Space Exploration, Art..."
                className="h-10 flex-1 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition-all placeholder:text-stone-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-500/15 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100 dark:placeholder:text-stone-500"
                disabled={generatingVocab}
              />
              <button
                onClick={generateVocabTopic}
                disabled={generatingVocab || !aiTopic.trim()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-stone-900 px-4 text-xs font-semibold text-white shadow-sm hover:bg-stone-700 disabled:opacity-40 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {generatingVocab ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" />
                    Generate
                  </>
                )}
              </button>
            </div>
            {genErrorVocab && (
              <p className="mt-2 text-xs font-semibold text-rose-500">{genErrorVocab}</p>
            )}
          </div>
        </div>
      </div>

      {/* Topic tabs */}
      <div className="flex flex-wrap gap-1.5">
        {allTopics.map((t) => (
          <button
            key={t.topic}
            onClick={() => { setSelectedTopic(t.topic); setShowQuiz(false) }}
            className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all ${
              t.topic === selectedTopic
                ? 'bg-stone-900 text-white dark:bg-white dark:text-stone-900'
                : 'border border-stone-200 text-stone-500 hover:border-stone-300 hover:bg-white hover:text-stone-700 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50 dark:hover:text-stone-300'
            }`}
          >
            {t.icon} {t.topic}
          </button>
        ))}
      </div>

      {!showQuiz ? (
        <>
          {/* Word cards */}
          <div className="grid gap-2 sm:grid-cols-2">
            {topic.items.map((item) => (
              <div key={item.word} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all hover:border-stone-300 dark:border-stone-700/50 dark:bg-stone-900/40 dark:hover:border-stone-600">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-bold text-stone-900 dark:text-white">{item.word}</p>
                    <p className="mt-0.5 text-[11px] italic text-stone-400 dark:text-stone-500">{item.definition}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                    IELTS
                  </span>
                </div>
                <p className="mt-2 text-xs text-stone-400 border-t border-stone-100 pt-2 leading-5 dark:border-stone-700 dark:text-stone-500">
                  &ldquo;{item.example}&rdquo;
                </p>
              </div>
            ))}
          </div>

          <div className="text-center">
            <button
              onClick={startQuiz}
              className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-stone-700 active:scale-[0.97] dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
            >
              <Brain className="h-4 w-4" />
              Test Yourself
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm dark:border-stone-700/50 dark:bg-stone-900/60">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-semibold text-stone-400 dark:text-stone-500">
              Question {quizIndex + 1} of {shuffled.length}
            </p>
            <button
              onClick={() => setShowQuiz(false)}
              className="text-xs font-medium text-stone-400 hover:text-stone-600 dark:text-stone-500 dark:hover:text-stone-300"
            >
              Back to list
            </button>
          </div>

          <div className="mb-6 text-center">
            <p className="text-sm text-stone-400 mb-2">What does this word mean?</p>
            <p className="text-2xl font-bold tracking-tight text-stone-900 dark:text-white">{currentQuizWord?.word}</p>
          </div>

          <div className="space-y-2">
            {quizOptions.map((def) => (
              <button
                key={def}
                onClick={() => { if (!quizRevealed) { setQuizAnswer(def); setQuizRevealed(true) } }}
                disabled={quizRevealed}
                className={`w-full rounded-lg border p-3 text-left text-xs transition-all ${
                  quizRevealed
                    ? def === currentQuizWord?.definition
                      ? 'border-orange-500 bg-orange-50 text-orange-700 dark:border-orange-500 dark:bg-orange-950/20 dark:text-orange-400'
                      : def === quizAnswer
                        ? 'border-rose-500 bg-rose-50 text-rose-600 dark:border-rose-500 dark:bg-rose-950/20 dark:text-rose-400'
                        : 'border-stone-100 opacity-50 dark:border-stone-700/30'
                    : def === quizAnswer
                      ? 'border-stone-900 bg-stone-50 text-stone-900 dark:border-white dark:bg-stone-800 dark:text-white'
                      : 'border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-stone-700 dark:text-stone-400 dark:hover:border-stone-600 dark:hover:bg-stone-800/50'
                }`}
              >
                {def}
              </button>
            ))}
          </div>

          {quizRevealed && (
            <div className="mt-4 text-center">
              <p className={`text-sm font-bold ${quizAnswer === currentQuizWord?.definition ? 'text-orange-600' : 'text-rose-500'}`}>
                {quizAnswer === currentQuizWord?.definition ? 'Correct!' : `The correct answer was: ${currentQuizWord?.definition}`}
              </p>
              <p className="mt-1 text-xs italic text-stone-400 dark:text-stone-500">&ldquo;{currentQuizWord?.example}&rdquo;</p>
              <button
                onClick={handleNextQuestion}
                className="mt-4 rounded-lg bg-stone-900 px-5 py-2 text-xs font-semibold text-white hover:bg-stone-700 dark:bg-white dark:text-stone-900 dark:hover:bg-stone-200"
              >
                {quizIndex < shuffled.length - 1 ? 'Next Question' : 'Done'}
              </button>
            </div>
          )}

          {/* Progress bar */}
          <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
            <div
              className="h-full rounded-full bg-stone-900 dark:bg-white transition-all"
              style={{ width: `${((quizIndex + (quizRevealed ? 1 : 0)) / shuffled.length) * 100}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════

const TABS = [
  { id: 'reading', label: 'Reading', icon: BookOpen, desc: 'Timed passages with IELTS questions' },
  { id: 'writing', label: 'Writing', icon: PenLine, desc: 'Task 1 & 2 prompts with timer' },
  { id: 'speaking', label: 'Speaking', icon: Mic, desc: 'Cue cards & discussion questions' },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookText, desc: 'Topic-based word lists & quizzes' },
] as const

type TabId = (typeof TABS)[number]['id']

export default function IELTSPage() {
  const { user, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<TabId>('reading')
  const [mounted, setMounted] = useState(false)
  const latestScoreRef = useRef<number | null>(null)
  const [, forceUpdate] = useState(0)

  const onScoreUpdate = useCallback((score: number) => {
    latestScoreRef.current = score
    forceUpdate((n) => n + 1)
  }, [])

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!authLoading && !user) router.push('/login')
  }, [user, authLoading, router])

  if (authLoading || !mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950">
      {/* HEADER */}
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-stone-200 bg-white/80 px-4 backdrop-blur-xl dark:border-stone-800 dark:bg-stone-900/80">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="flex h-7 w-7 items-center justify-center rounded-lg border border-stone-200 text-stone-400 transition-all hover:border-stone-300 hover:text-stone-600 dark:border-stone-700 dark:hover:border-stone-600 dark:hover:text-stone-300">
            <ArrowLeft className="h-3.5 w-3.5" />
          </Link>
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-stone-900 shadow-sm dark:bg-white">
            <GraduationCap className="h-3.5 w-3.5 text-white dark:text-stone-900" />
          </div>
          <span className="font-serif text-sm font-bold tracking-tight text-stone-900 dark:text-white">IELTS Prep</span>
          <span className="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-orange-600 dark:border-orange-800/50 dark:bg-orange-950/30 dark:text-orange-400">
            Free Practice
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 lg:px-8">
        {/* BAND SCORE RULER — signature element */}
        <BandScoreRuler score={latestScoreRef.current} target={7} />

        {/* TAB NAVIGATION */}
        <div className="mt-4 mb-6 grid grid-cols-4 gap-1.5">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-2 rounded-xl px-2 py-3 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-sm ring-1 ring-stone-200 dark:bg-stone-800 dark:text-white dark:ring-stone-700'
                    : 'text-stone-400 hover:bg-white/50 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-800/50 dark:hover:text-stone-300'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* TAB CONTENT */}
        <div className="space-y-5">
          {activeTab === 'reading' && <ReadingModule onScoreUpdate={onScoreUpdate} />}
          {activeTab === 'writing' && <WritingModule />}
          {activeTab === 'speaking' && <SpeakingModule />}
          {activeTab === 'vocabulary' && <VocabModule />}
        </div>
      </main>
    </div>
  )
}
