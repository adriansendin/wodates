/**
 * Script para crear usuarios completos en la aplicación
 * 
 * Este script crea usuarios con todos los campos rellenados, como si los hubiera
 * creado normalmente a través del uso normal de la aplicación.
 * 
 * Todas las variables de configuración están dentro de este archivo.
 * Puedes agregar múltiples usuarios en la lista USER_CONFIGS.
 * 
 * Uso:
 *   npx tsx scripts/working/create-user.ts
 * 
 * El script NO modifica nada del proyecto excepto el propio archivo de creación.
 */

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'node:url';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { SupabaseAuthService } from '../../src/app/services/supabase-auth-service';
import { UserPhotoService } from '../../src/app/services/user-photo-service';
import { RegisterRequest } from '../../src/domain/entities/Auth';
import { SystemUserService } from '../../src/app/services/system-user-service';
import { DocLoveHelper } from '../../src/app/services/doc-love-helper';
import { SupabaseLikeRepository } from '../../src/data/repositories/SupabaseLikeRepository';
import { SupabaseMatchRepository } from '../../src/data/repositories/SupabaseMatchRepository';
import { SupabaseMessageRepository } from '../../src/data/repositories/SupabaseMessageRepository';
import { SupabaseUserRepository } from '../../src/data/repositories/SupabaseUserRepository';
import { SupabaseUserAIProfileRepository } from '../../src/data/repositories/SupabaseUserAIProfileRepository';
import { GetAllUserChats } from '../../src/domain/use-cases/chat/GetAllUserChats';
import { GetUnprocessedMessages } from '../../src/domain/use-cases/chat/GetUnprocessedMessages';
import { GenerateUserProfileFromChats } from '../../src/domain/use-cases/chat/GenerateUserProfileFromChats';
import { UserAIProfileEmbeddingService } from '../../src/app/ai/profile/UserAIProfileEmbeddingService';
import { UserBioGenerationService } from '../../src/app/ai/profile/UserBioGenerationService';
import {
  runVerificationForUser,
  logVerificationResult,
  type VerificationDeps,
} from './create-user-verification';
import sharp from 'sharp';

/** Carpeta de fotos de perfil por usuario (1, 2, ... 20). Al mismo nivel que backend-api/ y ai-service/. */
const FOTOS_PERFILES_DIR = path.resolve(__dirname, '..', '..', '..', 'fotos_perfiles');

const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const MAX_PHOTOS_PER_USER = 5;

/** Límite del bucket avatars en Supabase (500 KB). Dejamos margen para no rozar el límite. */
const MAX_PHOTO_BYTES = 450 * 1024;
const MAX_PHOTO_DIMENSION = 1200;

// ============================================
// CONFIGURACIÓN DE USUARIOS
// ============================================
// Todas las variables necesarias para configurar los usuarios están aquí abajo.
// Puedes agregar múltiples usuarios en la lista USER_CONFIGS.
// Modifica estos valores según tus necesidades antes de ejecutar el script.

/** Sufijo que se añade al email de cada usuario (ej: iter="1" → rachel1@example.com). */
const iter: string = '21';

/** Ciudad de prueba para todos los usuarios: base + valor de iter (ej: iter='10' → 'Liverpool10'). */
const locationCity: string = 'Liverpool' + iter;

/** Número de usuarios a crear desde USER_CONFIGS (se toman los primeros N). Ej: 4 → solo 4, 8 → 8. */
const usersToCreate: number = 20;

type UserConfig = {
  email: string;
  name: string;
  birthDate: string;
  gender: 'male' | 'female' | 'non_binary';
  lookingFor: 'male' | 'female' | 'both';
  chat1: string;
  chat2: string;
  chat3: string;
};

// Lista de usuarios a crear (puedes agregar más usuarios aquí)
const USER_CONFIGS: UserConfig[] = [
  {
    email: 'leila' + iter + '@example.com',
    name: 'Leila',
    birthDate: '1994-03-17T00:00:00.000Z', // 31 years old
    gender: 'female' as const,
    lookingFor: 'male' as const,
  
    chat1:
      "My lifestyle is quite intentional: I like feeling that my days have a rhythm instead of just rushing from one thing to another. I’m not a big party person, but I’m very active in my own way. Most mornings start with a slow breakfast and music playing—usually soul, indie folk, or Arabic pop depending on my mood. I walk a lot, partly because I enjoy it and partly because London is best discovered on foot. I don’t go to the gym at all; instead I do yoga at home and long stretches in the evenings, especially after work. Food-wise, I’m mostly vegetarian (almost vegan, but I’m honest about cheese), and I love experimenting with recipes—simple, colourful meals rather than anything fancy. In my free time I read a lot, especially novels and essays about identity, culture, and psychology. I also journal regularly and enjoy photography as a quiet hobby: street scenes, light through windows, small everyday moments. Weekends are usually calm—markets, bookshops, meeting a friend for brunch, or spending a full afternoon reading without guilt. I enjoy travelling, but in a reflective way: cities, walking, museums, cafés, rather than adrenaline or packed itineraries. I value depth, calm energy, and feeling present more than constant stimulation.",
  
    chat2:
      "Professionally, my path hasn’t been linear, but it has been very honest. I currently work in user research and qualitative insights for a digital consultancy, focusing on how people actually experience products rather than just numbers on a dashboard. Before this, I worked in communications and content roles, which helped me develop a strong sense of storytelling and empathy. Over time, I realised that what truly interested me was understanding people’s motivations, frustrations, and unspoken needs. I enjoy interviews, synthesis, and turning messy human stories into clear insights teams can act on. Looking ahead, I want to deepen my expertise and eventually move into a lead or principal research role, where I can mentor others and shape ethical research practices. I’m not obsessed with climbing fast, but I care deeply about doing meaningful work and being taken seriously for my thinking. Long term, I’d like my career to give me stability, intellectual stimulation, and enough flexibility to live well—not just work endlessly.",
  
    chat3:
      "Family is very important to me, even though we don’t all live close to each other. I’m emotionally close to my parents and siblings, and we speak often—sometimes about serious things, sometimes about absolutely nothing. I value honesty and emotional openness in those relationships. My friendships are similar: I don’t have a huge group, but the people in my life know me properly. I’m the friend people come to when they need to talk or think something through. Socially, I prefer smaller gatherings and one-to-one connections over loud group settings. In romantic relationships, I’m thoughtful, loyal, and emotionally available. I’m not interested in drama or games; I want something calm, consistent, and affectionate. I believe relationships work best when both people have their own inner lives but also enjoy sharing the everyday moments—meals, conversations, routines. I’m looking for a serious relationship with someone emotionally mature, curious about the world, and comfortable with depth and vulnerability."
  }
,
{
  email: 'daniel' + iter + '@example.com',
  name: 'Daniel',
  birthDate: '1989-11-02T00:00:00.000Z', // 36 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "I’m quite an energetic and outdoors-oriented person, and a lot of my free time revolves around moving my body and being out of the house. I go to the gym four to five times a week and genuinely enjoy structured training—progressive overload, tracking lifts, and feeling stronger over time. That said, I’m not obsessive about it; it’s more about mental clarity and routine than aesthetics. Outside the gym, I love cycling around London, especially early mornings when the city feels quieter and more human. I’m not a big reader at all—if I sit still too long, my mind wanders—but I consume a lot of podcasts and long-form YouTube, mostly about business, personal development, and endurance sports. Socially, I like balance: I enjoy a good pub night with friends, watching football or UFC, but I’m also happy with a relaxed Sunday cooking at home. Food-wise, I eat pretty clean during the week and loosen up on weekends. I enjoy cooking simple, protein-heavy meals and experimenting with spices rather than following recipes. I travel when I can, usually for active holidays—hiking, road trips, or exploring cities by walking endlessly rather than ticking off landmarks. I’d describe myself as disciplined, optimistic, and practical, with a playful side once I feel comfortable.",

  chat2:
    "My career has been shaped by a strong sense of independence. I work as a product manager in a fintech company, where I sit between engineering, design, and business stakeholders. What I enjoy most is turning vague ideas into something concrete that actually solves a problem. Earlier in my career I worked in sales and account management, which taught me resilience, communication skills, and how to deal with pressure. Moving into product felt like a natural evolution—less noise, more thinking. Over the next few years, I want to grow into a senior or lead product role, taking more ownership of strategy and mentoring junior PMs. I’m ambitious, but I’m also realistic: I care about sustainable growth, not burnout or ego-driven titles. Long term, I’m open to launching my own venture or consulting, but only if it aligns with a healthy lifestyle and personal freedom. Work matters to me, but it’s not my entire identity.",

  chat3:
    "I come from a close-knit family and we’re very direct with each other—sometimes brutally honest, but always supportive. I speak to my parents weekly and make an effort to show up, even when life gets busy. My friendships are long-standing; many of my closest friends are people I’ve known for over a decade. Loyalty is a big value for me, and I don’t easily let people into my inner circle, but once they’re there, they’re there for good. In relationships, I’m steady, affectionate in a quiet way, and very consistent. I’m not into drama or emotional rollercoasters—I prefer clarity, mutual respect, and building something over time. I like the idea of partnership: two people pushing each other to be better while also enjoying ordinary life together. I’m looking for a serious relationship with someone grounded, kind, and emotionally intelligent, who values both independence and closeness."
}
,
{
  email: 'marco' + iter + '@example.com',
  name: 'Marco',
  birthDate: '1991-06-24T00:00:00.000Z', // 34 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is quite fluid and creative, and I don’t really believe in rigid routines. I spend a lot of my free time exploring the city in an unplanned way—walking with no destination, sitting in cafés to sketch or write, and noticing small details most people rush past. I don’t go to the gym and I’m not into organised fitness at all; movement for me comes naturally through walking, dancing at gigs, or cycling when the weather allows it. Music is a huge part of my life: I’m always discovering new artists, going to live shows, and building playlists that match different moods. I read occasionally, but in bursts—mostly novels, poetry, or essays rather than non-fiction or self-help. Food-wise, I’m relaxed and intuitive: I enjoy cooking when inspired, especially Italian or Mediterranean dishes, but I’m just as happy grabbing something spontaneous. Evenings often involve a film, a notebook, or meeting a friend for a long, meandering conversation. I like travel that feels immersive rather than efficient—staying in one place, getting to know the neighbourhood, and letting days unfold. I’m curious, emotionally expressive, and more guided by intuition than by schedules.",

  chat2:
    "Professionally, my path has been unconventional and very much driven by curiosity. I work as a freelance visual designer and illustrator, collaborating with small studios, cultural organisations, and independent brands. Before committing fully to freelance work, I tried more traditional agency roles, but I struggled with the lack of creative ownership and the feeling of producing work just to fill space. Freelancing suits me because it gives me autonomy and variety, even though it comes with uncertainty. I enjoy shaping visual identities, experimenting with concepts, and working closely with clients who care about meaning rather than scale. Looking ahead, I’d like to stabilise my income further and possibly develop my own long-term projects—whether that’s a personal design studio, a publication, or teaching workshops. Success for me isn’t about titles or corporate growth; it’s about sustainability, creative freedom, and feeling connected to my work.",

  chat3:
    "I’m close to my family in a warm, understated way—we don’t talk every day, but there’s a strong sense of mutual understanding and trust. I value emotional honesty and I try to bring that into all my relationships. My friendships tend to be deep and long-lasting, often built around shared experiences, creativity, or late-night conversations rather than structured plans. Socially, I can be very present and open, but I also need time alone to recharge. In romantic relationships, I’m affectionate, communicative, and emotionally available. I value authenticity over perfection and I’m drawn to people who are comfortable being themselves, even when that’s messy. I’m looking for a serious connection with someone who appreciates emotional depth, creativity, and a slower, more intentional approach to building intimacy."
}
,
{
  email: 'nadim' + iter + '@example.com',
  name: 'Nadim',
  birthDate: '1987-08-11T00:00:00.000Z', // 38 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "I’m a very people-oriented person, and a lot of my time and energy goes into social life and shared experiences. I’m the kind of person who always has something planned—even if it’s just a casual dinner or a walk with a friend. I don’t go to the gym and I’m not interested in structured workouts, but I’m constantly on the move: walking everywhere, dancing when there’s music, and generally staying active without thinking about it. I love hosting—having people over, cooking for groups, creating a warm atmosphere where everyone feels comfortable. Food is central to my life, especially big, generous meals inspired by Middle Eastern and Mediterranean cuisines. I’m not a big reader at all, but I love storytelling in other forms: podcasts, documentaries, and long conversations. My evenings are rarely spent alone unless I really need to recharge; otherwise, I’m out meeting friends, at a casual bar, or at someone’s home. Travel for me is about people and culture rather than sights—I love visiting friends abroad or staying in neighbourhoods where life feels local. I’d describe myself as warm, expressive, and very present with the people I care about.",

  chat2:
    "My career has always revolved around people and coordination. I work as an office and community manager in a co-working and events space, where no two days are the same. I handle everything from member relationships to logistics, problem-solving, and keeping the atmosphere positive and functional. Before this role, I worked in hospitality and event support, which taught me how to stay calm under pressure and read people quickly. I genuinely enjoy being the person who makes things run smoothly behind the scenes. Looking ahead, I’d like to move into a broader operations or community leadership role, possibly managing larger teams or launching my own small events-focused business. I’m ambitious in a grounded way—I want stability, responsibility, and a sense of purpose rather than corporate status or fast growth.",

  chat3:
    "Family is a big anchor in my life, and I stay closely connected with them, even though everyone is busy and scattered. I’m often the one organising family gatherings and making sure people stay in touch. My friendships are wide and varied, and I’m comfortable moving between different social circles. I’m very loyal and protective of the people I love. In relationships, I’m affectionate, expressive, and very communicative—I believe problems should be talked through rather than avoided. I’m looking for a serious, long-term relationship with someone emotionally mature, kind, and comfortable being part of a close social world. I value commitment, consistency, and building a shared life that includes friends, family, and a strong sense of togetherness."
}

,
{
  email: 'sophie' + iter + '@example.com',
  name: 'Sophie',
  birthDate: '1990-01-19T00:00:00.000Z', // 36 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is quite structured and intentionally high-energy. I’m someone who feels best when I’m physically active and mentally challenged, so most of my week revolves around training, work, and a small but solid social circle. I do CrossFit or strength training four to five times a week, and it’s non-negotiable for me—it keeps me grounded, focused, and confident. Outside of that, I enjoy long walks with audiobooks or podcasts, usually about business, tech, or psychology. I don’t read much fiction at all; if I’m consuming content, it’s usually practical or informative. Food-wise, I’m flexible but disciplined during the week: high-protein, balanced meals, nothing extreme, and then more relaxed social meals on weekends. I’m not into staying up late for no reason, but I enjoy a good dinner, a smart conversation, or a spontaneous plan if it fits my energy. Travel for me is often active or purposeful—city breaks, hiking trips, or combining work and travel when possible. I’d describe myself as driven, direct, and playful once you get past my slightly serious first impression.",

  chat2:
    "Professionally, I’m very focused and ambitious. I work as a software delivery lead in a scale-up environment, coordinating engineering teams and making sure complex projects actually ship on time. I enjoy pressure, ownership, and being trusted with responsibility. Earlier in my career I was a developer, but I realised I was more interested in systems, decision-making, and leadership than in coding full-time. Over the next few years, my goal is to move into a senior leadership role—either head of delivery or operations—where I can influence strategy and build high-performing teams. I’m realistic but very intentional about my career growth, and I invest a lot in self-improvement, from communication skills to understanding business fundamentals. Work matters to me, not just financially, but as a source of pride and identity.",

  chat3:
    "I’m close to my family, but we’re not overly emotional—we show care through reliability and showing up when it matters. I value independence and mutual respect in all relationships. My friendships are selective but strong; I prefer a few people I truly trust over a large social circle. Socially, I’m confident and direct, but I also need downtime to recharge after intense weeks. In romantic relationships, I’m loyal, honest, and very clear about my expectations. I’m not interested in ambiguity or games—I value consistency, mutual ambition, and emotional maturity. I’m looking for a serious relationship with someone who has their own drive, takes care of themselves, and wants to build something stable and supportive together, without unnecessary drama."
}
,{
  email: 'Chloe' + iter + '@example.com',
  name: 'Chloe',
  birthDate: '1988-04-05T00:00:00.000Z', // 37 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is quite simple and home-focused, and I’m very comfortable with that. I enjoy calm routines and having a place that really feels like home. I don’t go to the gym and I’ve never been particularly sporty, but I walk a lot and try to stay generally active without turning it into a project. Most evenings I cook dinner from scratch, usually something comforting rather than experimental, and then unwind with a series, a film, or a documentary. I read occasionally, mostly non-fiction or historical books, but I’m not someone who reads every day. My free time is often spent on small, grounding activities: organising my space, fixing things around the house, or spending time in local cafés where you start recognising faces. Weekends are usually low-key—grocery shopping, visiting family, watching football at home, or meeting a friend for a long lunch. I’m not very spontaneous, but I’m reliable, and I value stability over excitement. Travel for me is something I enjoy a few times a year, but I prefer short, well-planned trips rather than constant movement.",

  chat2:
    "I work as a facilities and maintenance coordinator for a large residential property group. It’s a very practical role that suits me well: I deal with issues as they come up, coordinate contractors, and make sure buildings are safe, functional, and looked after. I’ve always preferred hands-on, tangible work over abstract or highly competitive environments. Earlier in my career, I tried a more office-based administrative role, but I missed feeling useful in a concrete way. Looking ahead, I’d like to grow into a senior coordination or operations role with more responsibility, but still within a stable organisation. I’m not chasing rapid career changes or big titles—I care more about job security, being good at what I do, and having a work-life balance that leaves space for family and personal life.",

  chat3:
    "Family is a central part of my life, and I’m very involved in it. I see my parents regularly and help out whenever I can, and I’m close to my siblings and extended family as well. My friendships are mostly long-term, built on trust and shared history rather than constant activity. I’m not someone with a huge social circle, but I value the people I have deeply. In relationships, I’m steady, loyal, and dependable. I show care through actions rather than big gestures. I’m looking for a serious, long-term relationship with someone who values stability, honesty, and building a life together at a realistic pace. I’m not interested in drama or chasing excitement—I want something solid, warm, and genuinely supportive."
}
,
{
  email: 'maya' + iter + '@example.com',
  name: 'Maya',
  birthDate: '1993-12-01T00:00:00.000Z', // 32 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is quite dynamic and experience-driven. I get restless if my weeks all look the same, so I try to mix structure with novelty. I’m not a gym person at all, but I’m very active in a natural way: walking everywhere, swimming when I can, and doing yoga sporadically when my body asks for it. A lot of my free time goes into exploring—new neighbourhoods, exhibitions, talks, pop-up events, or just cafés I’ve never tried before. I love learning through experience rather than routines. I read in phases, mostly essays, memoirs, or books about culture and society, but I’m just as likely to spend an evening watching a long documentary or listening to interviews. Food-wise, I’m adventurous and flexible: I eat almost everything and enjoy discovering cuisines more than perfecting recipes at home. Travel is a huge part of my identity—I take every chance to go somewhere new, even if it’s just a few days, and I prefer trips that feel slightly unplanned. I’d describe myself as curious, adaptable, and energised by change, but also reflective once things slow down.",

  chat2:
    "Professionally, I work as a strategy and operations consultant, mostly with early-stage companies and NGOs. My role involves understanding messy situations, asking the right questions, and helping organisations make clearer decisions. Earlier in my career I worked in international development and research roles, which gave me a strong global perspective and a tolerance for ambiguity. I enjoy work that requires critical thinking, communication, and context rather than narrow specialisation. Looking ahead, I want to keep my career flexible—possibly moving towards independent consulting or project-based work that allows me to live in different countries over time. I’m ambitious, but not in a traditional ladder-climbing sense; I care more about autonomy, meaningful impact, and continuous learning than about titles or corporate prestige.",

  chat3:
    "I’m close to my family, but our relationships are based on trust and independence rather than constant contact. We support each other without being overly involved in each other’s daily lives. My friendships are spread across different cities and countries, which means I value depth over frequency—I might not see someone often, but when we do meet, it feels very real. Socially, I’m comfortable in new environments and enjoy meeting new people, but I also appreciate one-to-one connections where conversations go beyond small talk. In relationships, I’m affectionate, open-minded, and communicative. I value honesty, emotional intelligence, and mutual curiosity. I’m looking for a serious relationship with someone who is secure in themselves, adaptable, and excited by growth—both personal and shared—without needing life to be overly predictable."
}
,
{
  email: 'arjun' + iter + '@example.com',
  name: 'Arjun',
  birthDate: '1992-02-14T00:00:00.000Z', // 33 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is pretty calm and intentionally low-noise. I like London, but I don’t try to squeeze everything out of it every weekend—too much stimulation drains me. I’m not a gym person, and I’m not particularly athletic, but I do enjoy long walks with a good audiobook and I cycle casually when the weather isn’t miserable. Most of my free time goes into reading and building small personal projects. I’m the kind of person who can happily spend a Saturday afternoon in a bookshop, then come home and cook something simple while listening to a podcast. I read a lot—mostly non-fiction (history, behavioural science, technology, philosophy) and some sci-fi when I want something imaginative. I don’t drink much and I’m not into late nights out, but I do enjoy a cosy pub with a few friends and a proper conversation. I’m quite into board games and puzzle-type hobbies, and I love museums in a quiet, nerdy way—especially anything related to science or design. I prefer a few deep interests over lots of shallow ones, and I’m happiest when my life feels steady and mentally stimulating.",

  chat2:
    "I work as a data engineer, and I genuinely enjoy the craft side of it—building reliable pipelines, cleaning messy data, and making systems that don’t break when things scale. Earlier in my career I did a bit of analytics and realised I preferred the engineering side: the structure, the problem-solving, and the satisfaction of making something solid. I’m not someone who needs constant spotlight at work, but I care about competence and quality. Over the next couple of years I want to move into a more senior engineering role, with more ownership of architecture and mentoring. I’m also interested in the broader product impact of data—how it informs decisions without becoming misused or overhyped. Long term, I’d like to either lead a small technical team or work as a specialist with a lot of autonomy. I value workplaces that are thoughtful, ethical, and not addicted to chaos.",

  chat3:
    "My family relationships are steady and supportive. We’re not overly sentimental, but we show care through consistency, helping each other out, and staying connected even if we don’t speak every day. My friendships are similar: small circle, very strong bonds, and people I’ve known long enough that we can skip the small talk. Socially, I’m a bit selective—I like people, but I don’t enjoy performing or forcing myself into big group energy. In romantic relationships, I’m loyal, attentive, and quite affectionate once I feel secure with someone. I value kindness, emotional maturity, and honest communication. I’m looking for something serious and stable with a partner who appreciates a quieter kind of intimacy—shared routines, shared humour, shared curiosity—rather than constant excitement or drama."
}
,
{
  email: 'jordan' + iter + '@example.com',
  name: 'Jordan',
  birthDate: '1986-10-27T00:00:00.000Z', // 39 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is very social and outward-facing, and I get energy from being around people. I rarely spend a full weekend at home unless I’m exhausted or travelling. I go to the gym two or three times a week, but more for stress relief than aesthetics—I enjoy boxing-style workouts and anything that helps me switch my brain off. A lot of my free time revolves around social plans: dinners, birthdays, events, spontaneous drinks, or meeting friends-of-friends. I enjoy being out in the city and I’m very comfortable striking up conversations with new people. I don’t read much at all, but I listen to podcasts and follow news and culture closely. Food-wise, I eat almost everything and I love trying new places rather than cooking elaborate meals at home. Travel is something I prioritise—I take several trips a year and enjoy both city breaks and more relaxed holidays with friends. I’d describe myself as confident, expressive, and energetic, with a tendency to say yes to opportunities rather than overthink them.",

  chat2:
    "Professionally, I work in partnerships and business development for a media and events company. My role is all about relationships: identifying opportunities, negotiating collaborations, and keeping long-term partners engaged. Earlier in my career, I worked in marketing and communications, which gave me a strong foundation in messaging and positioning. I enjoy fast-paced environments where decisions are made quickly and adaptability matters. Over the next few years, I want to step into a senior commercial or partnerships lead role, with more influence over strategy and revenue growth. I’m ambitious and comfortable with risk, and I enjoy roles where performance is visible and rewarded. Long term, I’d be open to launching my own venture, especially in the media, events, or community space.",

  chat3:
    "I’m close to my family and I make a real effort to stay present in their lives, even with a busy schedule. I have a wide social network and I enjoy maintaining connections across different groups—work, old friends, new acquaintances. That said, I do have a core group of people I trust deeply. In relationships, I’m affectionate, communicative, and very open about how I feel. I value honesty, emotional openness, and shared enthusiasm for life. I’m looking for a serious relationship with someone who enjoys social energy, is confident in themselves, and wants a partner to build an exciting but supportive life with. I believe commitment and fun don’t have to be opposites."
}
,
{
  email: 'elin' + iter + '@example.com',
  name: 'Elin',
  birthDate: '1990-07-09T00:00:00.000Z', // 35 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is very grounded and nature-oriented, and I actively try to keep my life from becoming too screen-heavy. I live in London, but I don’t feel particularly attached to the idea of ‘city life’ as an identity. I spend a lot of my free time outdoors—long walks in parks, weekend hikes just outside the city, and swimming whenever I get the chance, even if the weather isn’t perfect. I don’t go to the gym at all; movement for me comes from walking, stretching, and being outside rather than structured workouts. I read a lot, especially novels and nature writing, and I can easily spend an afternoon reading with a cup of tea and no background noise. I enjoy cooking simple, seasonal food and eating at home most days. Socially, I’m quite selective and I prefer daytime plans—walks, coffee, quiet lunches—over late nights. Travel for me is about landscapes and calm rather than cities or packed itineraries. I value slowness, presence, and feeling connected to my body and surroundings.",

  chat2:
    "Professionally, I work as an environmental policy advisor, focusing on sustainability and land-use projects. My work is research-heavy and involves writing, analysis, and collaboration with local authorities and NGOs. Earlier in my career I worked in academic research, which helped me develop strong critical thinking skills but also made me realise I wanted my work to have more direct, practical impact. I enjoy roles where I can contribute thoughtfully without constant urgency or performative productivity. Over the next few years, I’d like to deepen my expertise and possibly move into a senior advisory or policy-shaping role. Career success for me is less about progression speed and more about alignment—working on issues I care about, in an environment that respects balance and integrity.",

  chat3:
    "I’m close to my family in a quiet, steady way. We’re not overly expressive, but there’s a lot of trust and mutual support. My friendships are similar: a small circle of people I’ve known for years, with relationships built on shared values rather than constant contact. I’m not someone who needs a busy social calendar to feel fulfilled. In relationships, I’m gentle, loyal, and emotionally attentive. I value kindness, emotional maturity, and calm communication. I’m looking for a serious relationship with someone who is thoughtful, grounded, and comfortable with a slower pace of life—someone who enjoys shared silence as much as conversation, and who sees partnership as something steady and nurturing rather than intense or chaotic."
}
,
{
  email: 'samira' + iter + '@example.com',
  name: 'Samira',
  birthDate: '1995-05-22T00:00:00.000Z', // 30 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is a mix of creativity, comfort, and curiosity. I enjoy London a lot, but I don’t feel the need to be out every night to feel alive. I’m not a gym person, but I do Pilates once a week and walk everywhere—it keeps me feeling good without taking over my schedule. Food is a big joy for me: I love cooking, especially experimenting with flavours from different cultures, and I’m the kind of person who plans weekends around a recipe I want to try or a place I want to eat. I read occasionally, mostly novels or memoirs, but I’m just as happy watching a film or a good series with intention (no endless scrolling). I enjoy museums, talks, and workshops, especially anything hands-on or design-related. Weekends usually include a balance of social time and home time—brunch with friends, a long walk, then a cosy evening cooking and listening to music. I travel a few times a year and enjoy city breaks where food, walking, and atmosphere matter more than ticking boxes. I’d describe myself as warm, observant, and quietly enthusiastic about the things I care about.",

  chat2:
    "Professionally, I work as a service designer in the public sector, focusing on making systems more human and accessible. My role sits between research, design, and implementation, which suits me well because I like both thinking and doing. Earlier in my career, I worked in graphic design and later moved into UX, realising I was more interested in the broader systems behind experiences than just visuals. I enjoy collaborative environments and projects that have real-world impact, even if progress is slow. Over the next few years, I want to deepen my expertise and move into a senior design role where I can influence strategy and mentor junior designers. I’m ambitious, but I value sustainability and balance—I want a career that grows with me, not one that burns me out.",

  chat3:
    "I’m close to my family and we have a very warm, supportive dynamic. We talk often and I value feeling emotionally connected, even as everyone lives their own lives. My friendships are similar: I have a few very close friends and some wider social circles, but I prioritise depth over constant activity. I enjoy hosting small dinners and bringing people together in a relaxed way. In romantic relationships, I’m affectionate, communicative, and thoughtful. I value emotional intelligence, consistency, and a sense of partnership. I’m looking for a serious relationship with someone kind, emotionally aware, and curious about the world—someone who enjoys both shared routines and discovering new things together."
}
,
{
  email: 'tomasa' + iter + '@example.com',
  name: 'Tomasa',
  birthDate: '1990-09-30T00:00:00.000Z', // 35 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is quite structured and predictable, and that’s something I genuinely enjoy. I like knowing how my week will look and having routines that keep life simple and manageable. I go to the gym three times a week, mostly strength training and some cardio, but I’m not obsessed with it—it’s more about health and mental clarity than pushing limits. Outside of that, I’m fairly low-key. I enjoy cooking at home, usually straightforward meals that I can repeat and improve over time rather than constantly experimenting. I don’t read a lot, but I do follow the news and listen to podcasts about economics, technology, and current affairs. My evenings are usually calm: cooking, watching a series, or doing something practical around the house. I’m not very spontaneous, but I’m consistent and reliable. Travel for me is something I plan carefully and enjoy a few times a year; I prefer well-organised trips where I can relax rather than improvising everything. I value stability, order, and a sense of progress in everyday life.",

  chat2:
    "Professionally, I work as a financial analyst in a large infrastructure company. My role involves forecasting, budgeting, and making sure decisions are backed by solid numbers rather than assumptions. Earlier in my career, I tried a more general business role, but I realised I was much more comfortable working with data, structure, and clear frameworks. I enjoy responsibility and being trusted with important decisions, even if my work isn’t very visible. Over the next few years, my goal is to move into a senior analyst or finance manager position, with more influence over long-term planning. I’m ambitious in a measured way—I prefer steady progression and long-term security over risky jumps or constant change.",

  chat3:
    "I’m close to my family and see them regularly, and we have a very practical, supportive relationship. We show care by being present and helping each other when needed rather than through big emotional conversations. My friendships are similar: small, stable, and long-term. I’m not someone who needs constant social activity, but I value loyalty and trust deeply. In relationships, I’m calm, dependable, and committed. I may not be the most expressive person verbally, but I show care through consistency and actions. I’m looking for a serious, long-term relationship with someone who values stability, honesty, and building a life together step by step, without unnecessary drama or uncertainty."
}
,
{
  email: 'martin' + iter + '@example.com',
  name: 'Martin',
  birthDate: '1991-01-12T00:00:00.000Z', // 35 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is very culture-driven and a bit unconventional. I don’t really follow strict routines, and my energy tends to peak later in the day rather than early mornings. I’m not a gym person at all, but I stay active through walking, dancing, and just moving around the city a lot. A big part of my free time goes into cultural life: theatre, live music, talks, film screenings, and exhibitions. I love being in spaces where ideas are exchanged and conversations flow easily. I read quite a lot, mostly fiction, essays, and anything related to social issues, identity, or art, but I read in intense phases rather than every day. Evenings are often spent out—meeting friends, going to events, or having long dinners that turn into deep conversations. Food is social for me; I enjoy eating out and sharing meals much more than cooking alone. Travel is important, especially to cities with a strong cultural scene. I’d describe myself as expressive, curious, and energised by people and ideas.",

  chat2:
    "Professionally, I work in communications and public relations for arts and cultural organisations. My role involves storytelling, media relations, and shaping narratives around creative projects. Earlier in my career, I worked in journalism and editorial roles, which taught me how to research, write under pressure, and think critically. I enjoy work that sits at the intersection of creativity, society, and public discourse. Over the next few years, I’d like to move into a more senior communications or strategy role, possibly advising organisations on long-term positioning rather than just campaigns. I’m ambitious, but my motivation comes from influence and meaning rather than hierarchy or corporate growth.",

  chat3:
    "I’m close to my family, but I’ve always been quite independent, so our relationships are based on mutual respect rather than daily involvement. My friendships are wide-ranging and often connected to creative or cultural circles. I enjoy meeting new people and maintaining a broad social network, but I also value a few friendships where vulnerability and honesty are possible. In romantic relationships, I’m emotionally open, expressive, and communicative. I value intellectual connection, shared curiosity, and emotional awareness. I’m looking for a serious relationship with someone confident, emotionally intelligent, and comfortable in social and cultural environments—someone who enjoys both intensity and depth without needing life to be overly predictable."
}
,
{
  email: 'owena' + iter + '@example.com',
  name: 'Owena',
  birthDate: '1989-05-03T00:00:00.000Z', // 36 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is hands-on and practical, and I get a lot of satisfaction from making and fixing things. I’m not into the gym or organised fitness, but I stay active through cycling, DIY projects, and weekend jobs that keep me moving. I spend a lot of my free time in my workshop space—woodworking, basic metal work, restoring old furniture, or learning new tools through trial and error. I enjoy quiet focus and working with my hands after a day at work. I read occasionally, mostly technical books, manuals, or long articles rather than novels. Evenings are usually calm: cooking something simple, listening to music or a podcast, and working on a small project. Socially, I prefer one-to-one plans or small groups; big crowds drain me quickly. Travel for me is usually purpose-driven—visiting friends, doing a course, or exploring places known for craft or design. I value competence, patience, and doing things properly.",

  chat2:
    "Professionally, I work as a building services technician specialising in electrical and smart-home systems. My role combines problem-solving, technical knowledge, and on-site work, which suits me much more than a desk-only job. Earlier in my career, I tried a more office-based engineering role, but I missed seeing tangible results from my work. Over the next few years, I’d like to deepen my expertise and potentially move into a senior technical or specialist role, or even set up a small independent business. I’m ambitious in a practical way: I want to be very good at what I do, trusted for my skills, and able to work with a high level of autonomy.",

  chat3:
    "I’m close to my family and we have a very straightforward, supportive dynamic. We’re not overly emotional, but we’re reliable and present for each other. My friendships are similar—long-standing, low-maintenance, and built on trust rather than constant contact. In relationships, I’m loyal, calm, and dependable. I’m not very flashy or expressive, but I show care through consistency and effort. I’m looking for a serious relationship with someone grounded, patient, and emotionally mature, who values stability and building a life together slowly and intentionally."
}
,
{
  email: 'ibrahim' + iter + '@example.com',
  name: 'Ibrahim',
  birthDate: '1993-03-28T00:00:00.000Z', // 32 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is quite intellectual and reflective, and I organise my free time around learning and quiet curiosity rather than constant activity. I’m not into the gym or structured exercise, but I walk a lot—usually with a book or an article in mind—and I enjoy slow, thoughtful routines. Reading is one of my main pleasures: philosophy, history, long-form essays, and the occasional novel when I want something immersive. I also enjoy writing, mostly for myself—notes, reflections, ideas I want to think through properly. Evenings are often spent reading, cooking something simple, or having long conversations with a close friend over tea or wine. I’m not particularly spontaneous, but I enjoy depth and continuity. Travel for me is often tied to learning—visiting cities for their history, libraries, or academic events rather than nightlife or adventure. I’d describe myself as calm, observant, and quietly curious about how people and societies work.",

  chat2:
    "Professionally, I work as a policy researcher focusing on migration and social integration. My role involves a lot of reading, analysis, and writing, as well as collaborating with academics and practitioners. Earlier in my career, I considered staying purely in academia, but I wanted my work to have a clearer connection to real-world impact. I enjoy thinking deeply about complex issues and communicating them clearly to non-specialist audiences. Over the next few years, I’d like to move into a senior research or advisory role where I can shape policy discussions and mentor younger researchers. Career-wise, I’m motivated by substance and integrity more than visibility or fast progression.",

  chat3:
    "I’m close to my family, although our relationships are calm and respectful rather than emotionally intense. We support each other in practical ways and value independence. My friendships are small in number but strong in depth—people I can talk to for hours about ideas, life choices, and personal growth. Socially, I’m selective, but I’m warm once I feel comfortable. In relationships, I’m thoughtful, emotionally attentive, and very committed once trust is established. I value honesty, patience, and emotional maturity. I’m looking for a serious relationship with someone intellectually curious, emotionally grounded, and interested in building a partnership based on shared values, reflection, and mutual respect."
}
,
{
  email: 'amin' + iter + '@example.com',
  name: 'Amin',
  birthDate: '1996-08-14T00:00:00.000Z', // 29 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is quite balanced but lively, and I’m someone who enjoys feeling connected—to my body, to people, and to what’s happening around me. I’m not hardcore about fitness, but I do enjoy staying active: I go to spin or barre classes a couple of times a week, do yoga when I need to slow down, and walk everywhere. I’m quite curious about wellness in a non-extreme way—trying new classes, breathwork sessions, or workshops, but without turning it into an identity. I enjoy social plans and usually have a few things in the diary, whether it’s dinner with friends, a talk, or a casual drink. At the same time, I protect my solo time and enjoy slow mornings with coffee and music. I read occasionally—mostly novels or personal essays—and I like podcasts about relationships, psychology, and culture. Food-wise, I eat intuitively and enjoy both cooking simple meals and going out to eat. Travel is important to me, especially trips that mix relaxation and exploration. I’d describe myself as warm, upbeat, and emotionally aware.",

  chat2:
    "Professionally, I work in people operations and wellbeing for a mid-sized company. My role focuses on employee experience, internal culture, and making sure people feel supported rather than just productive. Earlier in my career, I worked in recruitment, which gave me insight into how people present themselves versus how they actually feel at work. Moving into people ops felt more aligned with my values. Over the next few years, I want to grow into a senior people or HR partner role, where I can influence leadership decisions and help build healthier workplace cultures. I’m ambitious, but my ambition is values-led—I want responsibility and impact, not just progression for its own sake.",

  chat3:
    "I’m close to my family and we have a very warm, communicative relationship. We talk often and support each other emotionally as well as practically. My friendships are a big part of my life—I have a solid group of friends who feel like chosen family, and I enjoy nurturing those connections. Socially, I’m open and friendly, but I value depth and emotional honesty over surface-level interaction. In relationships, I’m affectionate, supportive, and very communicative. I value emotional safety, mutual growth, and consistency. I’m looking for a serious relationship with someone emotionally mature, kind, and self-aware—someone who enjoys building a partnership that feels both secure and joyful."
}
,{
  email: 'leo' + iter + '@example.com',
  name: 'Leo',
  birthDate: '1991-11-18T00:00:00.000Z', // 34 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is quite urban and digitally oriented, and I’m naturally more of a night person than an early riser. I don’t follow very strict routines, but I do like having a loose structure that leaves room for spontaneity. I’m not a gym regular, though I try to stay active through walking, occasional climbing sessions, and cycling when the mood hits. A lot of my free time goes into creative and digital hobbies: gaming with friends (mostly co-op or strategy games), tinkering with side projects, and keeping up with tech, design, and internet culture. I read occasionally, but mostly short-form—articles, essays, and long threads rather than full books. Evenings are often spent meeting friends, cooking something quick, or getting lost in a game or a film. I enjoy the buzz of the city at night—late dinners, quiet bars, or just walking when things slow down. Travel for me is usually city-based and curiosity-driven. I’d describe myself as curious, adaptable, and quietly creative.",

  chat2:
    "Professionally, I work as a front-end developer for a digital product studio. My role sits at the intersection of design and engineering, which I really enjoy because it lets me combine logic with aesthetics. Earlier in my career, I experimented with more generalist roles, but I realised I preferred building things and seeing immediate results. I enjoy working in small, agile teams where ideas move quickly and collaboration matters. Over the next few years, I’d like to grow into a senior developer or technical lead role, with more ownership over architecture and mentoring. I’m ambitious, but I value autonomy and learning over hierarchy. Long term, I’d like my career to stay flexible and creative rather than overly corporate.",

  chat3:
    "I’m close to my family, even though we’re not constantly in touch. There’s a strong sense of trust and support, and I know we show up for each other when it matters. My friendships are a mix of long-standing friends and newer connections, often built around shared interests like games, tech, or creative projects. Socially, I’m comfortable in small groups and prefer environments where conversation flows naturally. In relationships, I’m affectionate, honest, and emotionally present once trust is built. I value communication, mutual respect, and shared humour. I’m looking for a serious relationship with someone open-minded, emotionally aware, and comfortable with both quiet nights in and spontaneous city plans."
}
,
{
  email: 'fran' + iter + '@example.com',
  name: 'Fran',
  birthDate: '1988-06-02T00:00:00.000Z', // 37 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle is very people- and home-centred. I get a lot of joy from taking care of my space and the people around me. I’m not interested in the gym or structured exercise, but I stay active through walking, running errands on foot, and being generally on the move throughout the day. I love cooking and I spend a lot of time in the kitchen—preparing meals, trying family recipes, and making food that brings people together. I read occasionally, mostly novels or poetry, but I’m more drawn to conversation and shared moments than solitary hobbies. My evenings are usually quiet and home-based, sometimes with a friend dropping by, sometimes just cooking and listening to music. I enjoy travel, but in a grounded way—visiting family, spending time by the sea, or staying somewhere comfortable rather than constantly exploring. I value warmth, routine, and feeling emotionally connected to my environment.",

  chat2:
    "Professionally, I work part-time as a teaching assistant in a primary school. I chose this role because I enjoy working with children and being part of a supportive community. Earlier in my career, I tried a more demanding full-time role, but I realised that work-life balance and emotional wellbeing mattered more to me than constant progression. I’m proud of my work even if it’s not high-status or fast-moving. Over the next few years, I’d like to continue in education or care-focused roles, possibly with additional training, but I’m not driven by ambition in a traditional sense. For me, success is about stability, contribution, and having time and energy for personal relationships.",

  chat3:
    "Family is the most important part of my life, and I’m very close to mine. We talk often, support each other, and spend a lot of time together. My friendships are similarly close-knit and emotionally rich. I’m someone people rely on, and I take that responsibility seriously. In romantic relationships, I’m deeply affectionate, loyal, and emotionally expressive. I value commitment, emotional safety, and long-term partnership. I’m looking for a serious relationship with someone kind, dependable, and emotionally open—someone who values family, stability, and building a warm, supportive life together."
}
,
{
  email: 'noah' + iter + '@example.com',
  name: 'Noah',
  birthDate: '1992-12-06T00:00:00.000Z', // 33 years old
  gender: 'female' as const,
  lookingFor: 'male' as const,

  chat1:
    "My lifestyle is quite intense and idea-driven, and I tend to move in bursts of energy rather than steady routines. I’m not great with rigid schedules, but I’m very engaged with whatever I’m interested in at the moment. I don’t go to the gym consistently, though I try to stay active with runs, long walks, or the occasional class when I feel my body needs it. A lot of my free time goes into thinking, reading, and talking—brainstorming ideas, debating concepts, or getting lost in articles and essays about technology, society, and psychology. I read a lot, but in a messy way: several books at once, plus long reads online. Evenings can be very different depending on my mood—sometimes I’m deep into a project at home, other times I’m out meeting friends or going to talks and events. Food is functional during the week and more social on weekends. Travel for me is inspiring rather than relaxing; I like places that spark new ideas. I’d describe myself as curious, energetic, and mentally restless, but also reflective once I slow down.",

  chat2:
    "Professionally, I’m building my own startup in the digital product space. Before this, I worked in strategy and innovation roles, often moving between teams and projects. I realised fairly early on that traditional career paths didn’t suit me—I prefer ownership, uncertainty, and learning through doing. Running my own project is demanding and sometimes chaotic, but it feels aligned with how my mind works. Over the next few years, my focus is on making this venture sustainable and meaningful, rather than chasing rapid growth at any cost. I’m ambitious, but I’ve learned the hard way that burnout is real, so I’m trying to build something that allows for a life outside of work as well.",

  chat3:
    "I’m close to my family, even though we’re all quite independent. Our relationships are based on trust, honesty, and giving each other space to grow. My friendships are a mix of long-term friends and newer connections, often formed through work, ideas, or shared curiosity. Socially, I enjoy deep conversations more than surface-level interaction, and I value people who challenge my thinking. In relationships, I’m emotionally open, honest, and very invested once I commit. I value communication, mutual support, and growing together rather than fitting into predefined roles. I’m looking for a serious relationship with someone emotionally intelligent, grounded, and comfortable with ambition and uncertainty—someone who wants to build something meaningful together, both individually and as a couple."
}
,
{
  email: 'peter' + iter + '@example.com',
  name: 'Peter',
  birthDate: '1991-10-15T00:00:00.000Z', // 34 years old
  gender: 'male' as const,
  lookingFor: 'female' as const,

  chat1:
    "My lifestyle revolves a lot around food, people, and enjoying everyday pleasures properly. I’m not someone who chases extreme routines or optimisation—I prefer consistency with space for enjoyment. I don’t go to the gym and never really have; instead, I stay active by walking everywhere, doing the occasional yoga class when I feel stiff, and generally keeping myself moving without forcing it. Cooking is one of my favourite ways to unwind: I love trying new recipes, especially comfort food from different cultures, and I’m happiest when I’m feeding other people. I enjoy hosting small dinners or inviting friends over for casual evenings that end up lasting hours. I read sometimes, mostly fiction or memoirs, but I’m just as likely to spend an evening listening to music, watching a well-chosen series, or talking. Weekends usually involve a mix of markets, long lunches, and unplanned social time. I travel a few times a year and prefer trips that are relaxed and indulgent rather than packed with activities. I’d describe myself as warm, grounded, and very present in the moment.",

  chat2:
    "Professionally, I work in account management for a creative agency, acting as the bridge between clients and internal teams. I enjoy managing relationships, understanding what people really want, and translating that into something concrete and realistic. Earlier in my career, I worked in customer-facing roles across different industries, which taught me patience, communication, and how to read situations quickly. I’m good at keeping things moving without creating unnecessary stress. Over the next few years, I’d like to step into a more senior client or operations role where I have more responsibility and influence, but I’m not driven by flashy titles. I care about being respected for my competence and reliability, and about working in environments where people treat each other well.",

  chat3:
    "I’m very close to my family and we speak often—they’re a big source of emotional stability for me. My friendships are deep and long-standing, and I’m the kind of person people call when they need support or a safe space. Socially, I enjoy being around people, but I’m not interested in constant noise or chaos; I prefer meaningful connection. In relationships, I’m affectionate, loyal, and emotionally available. I value consistency, kindness, and the feeling that we’re a team. I’m looking for a serious relationship with someone emotionally mature, communicative, and grounded—someone who enjoys sharing everyday life and building something steady together, without drama or games."
}

];

/** Configuraciones que se usan en esta ejecución (primeros usersToCreate de USER_CONFIGS). */
const CONFIGS_TO_CREATE = USER_CONFIGS.slice(0, usersToCreate);

// Datos adicionales del perfil (opcionales)
const PROFILE_CONFIG = {
  password: '123456',
  location: locationCity, // Ciudad (requerido)
  country: 'UK', // País (opcional, por defecto 'Spain')
  min_age: 27, // Edad mínima preferida (18-100)
  max_age: 37, // Edad máxima preferida (18-100, debe ser >= min_age)
  show_bio_in_feed: true, // Mostrar biografía en el feed
  
  // Plan familiar
  has_children: false, // ¿Tiene hijos?
  wants_children: 'yes' as const, // 'yes' | 'no' | 'not_sure'
  cares_about_partner_children: 'yes' as const, // 'yes' | 'no'
  
  // Hábitos
  smoking: 'no' as const, // 'no' | 'occasionally' | 'regularly'
  cares_about_partner_smoking: 'yes' as const, // 'yes' | 'no'
};

// ============================================
// FIN DE CONFIGURACIÓN
// ============================================

// Cargar variables de entorno
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY deben estar configurados en .env');
  process.exit(1);
}

type CreatedUser = {
  id: string;
  email: string;
  name: string;
  matchId?: string;
};

async function createSingleUser(
  userConfig: UserConfig,
  profileConfig: typeof PROFILE_CONFIG,
  authService: SupabaseAuthService,
  adminClient: any,
  systemUserService: SystemUserService,
  messageRepository: SupabaseMessageRepository
): Promise<CreatedUser | null> {
  try {
    console.log(`\n📋 Creando usuario: ${userConfig.name} (${userConfig.email})`);

    // Paso 1: Crear usuario en Supabase Auth y public.users
    const registerRequest: RegisterRequest = {
      email: userConfig.email,
      password: profileConfig.password,
      name: userConfig.name,
      birthDate: userConfig.birthDate,
      gender: userConfig.gender,
      location: profileConfig.location,
      country: profileConfig.country,
      lookingFor: userConfig.lookingFor,
    };

    const authUser = await authService.registerUser(registerRequest);
    console.log(`   ✅ Usuario creado: ${authUser.name} (ID: ${authUser.id})`);

    // Paso 2: Actualizar perfil con campos adicionales
    const { error: updateError } = await adminClient
      .from('users')
      .update({
        min_age: profileConfig.min_age,
        max_age: profileConfig.max_age,
        show_bio_in_feed: profileConfig.show_bio_in_feed,
        has_children: profileConfig.has_children,
        wants_children: profileConfig.wants_children,
        cares_about_partner_children: profileConfig.cares_about_partner_children,
        smoking: profileConfig.smoking,
        cares_about_partner_smoking: profileConfig.cares_about_partner_smoking,
      })
      .eq('id', authUser.id);

    if (updateError) {
      throw new Error(`Error al actualizar perfil: ${updateError.message}`);
    }

    // Paso 3: Crear match con Doc Love (como en el registro normal)
    const matchResult = await systemUserService.createWelcomeMatch(authUser.id);
    
    if (matchResult.success) {
      console.log(`   ✅ Match con Doc Love creado: ${matchResult.data.id}`);
      
      // Paso 4: Enviar 3 mensajes del usuario a Doc Love (sin marcar como procesados;
      // profile_processed_at queda NULL para que el job nocturno los procese).
      const userMessages = [userConfig.chat1, userConfig.chat2, userConfig.chat3];

      for (let i = 0; i < userMessages.length; i++) {
        const messageContent = userMessages[i];
        if (!messageContent) {
          console.warn(`   ⚠️  Mensaje ${i + 1} está vacío, saltando...`);
          continue;
        }

        const messageResult = await messageRepository.create({
          matchId: matchResult.data.id,
          senderId: authUser.id,
          content: messageContent,
        });

        if (!messageResult.success) {
          console.warn(`   ⚠️  Error al enviar mensaje ${i + 1}: ${messageResult.error.message}`);
        }

        // Pequeño delay entre mensajes para simular conversación natural
        if (i < userMessages.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      }
      console.log(`   ✅ Mensajes enviados al chat con Doc Love`);

      return {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
        matchId: matchResult.data.id,
      };
    } else {
      console.warn(`   ⚠️  No se pudo crear el match con Doc Love: ${matchResult.error.message}`);
      return {
        id: authUser.id,
        email: authUser.email,
        name: authUser.name,
      };
    }
  } catch (error) {
    console.error(`   ❌ Error al crear usuario ${userConfig.email}:`, error);
    
    if (error instanceof Error) {
      if (error.message.includes('already been registered') || error.message.includes('already exists')) {
        console.error(`   ⚠️  El usuario ${userConfig.email} ya existe.`);
      }
    }
    
    return null;
  }
}

type SupabaseConfigForPhotos = { url: string; serviceRoleKey: string };

/**
 * Redimensiona y comprime la imagen para que no supere el límite del bucket (500 KB).
 * Devuelve un JPEG listo para subir.
 */
async function resizeImageUnderLimit(
  buffer: Buffer,
  _mimeType: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  let pipeline = sharp(buffer)
    .rotate()
    .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, { fit: 'inside', withoutEnlargement: true });

  const qualities = [85, 70, 55, 40];
  for (const quality of qualities) {
    const out = await pipeline
      .jpeg({ quality, chromaSubsampling: '4:4:4' })
      .toBuffer();
    if (out.length <= MAX_PHOTO_BYTES) {
      return { buffer: out, mimeType: 'image/jpeg' };
    }
    pipeline = sharp(buffer)
      .rotate()
      .resize(MAX_PHOTO_DIMENSION, MAX_PHOTO_DIMENSION, { fit: 'inside', withoutEnlargement: true });
  }
  const out = await pipeline.jpeg({ quality: 30 }).toBuffer();
  return { buffer: out, mimeType: 'image/jpeg' };
}

/**
 * Sube las fotos de la carpeta fotos_perfiles/{folderNumber} al bucket de Supabase
 * como fotos de perfil del usuario recién creado. Máximo MAX_PHOTOS_PER_USER fotos.
 * Las imágenes se redimensionan/comprimen para no superar el límite del bucket (500 KB).
 */
async function uploadProfilePhotosForUser(
  config: SupabaseConfigForPhotos,
  userId: string,
  folderNumber: number
): Promise<void> {
  const dir = path.join(FOTOS_PERFILES_DIR, String(folderNumber));
  if (!fs.existsSync(dir)) {
    console.log(`   📁 Carpeta ${dir} no existe, omitiendo fotos para usuario ${folderNumber}`);
    return;
  }
  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    console.log(`   📁 ${dir} no es un directorio, omitiendo fotos`);
    return;
  }

  const files = fs.readdirSync(dir)
    .filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ALLOWED_IMAGE_EXTENSIONS.has(ext);
    })
    .sort();

  if (files.length === 0) {
    console.log(`   📁 No hay imágenes en ${dir}`);
    return;
  }

  const toUpload = files.slice(0, MAX_PHOTOS_PER_USER);
  const photoService = new UserPhotoService(config);
  let uploaded = 0;

  for (const file of toUpload) {
    const filePath = path.join(dir, file);
    const ext = path.extname(file).toLowerCase();
    const mimeType = MIME_BY_EXT[ext] ?? 'image/jpeg';
    try {
      const buffer = fs.readFileSync(filePath);
      const { buffer: resizedBuffer, mimeType: resizedMime } = await resizeImageUnderLimit(buffer, mimeType);
      const result = await photoService.addUserPhoto(userId, resizedBuffer, resizedMime);
      if (result.success) {
        uploaded++;
      } else {
        console.warn(`   ⚠️  No se pudo subir ${file}:`, result.error.message);
      }
    } catch (err) {
      console.warn(`   ⚠️  Error leyendo/subiendo ${file}:`, err instanceof Error ? err.message : err);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  if (uploaded > 0) {
    console.log(`   ✅ Fotos de perfil subidas: ${uploaded} desde fotos_perfiles/${folderNumber}`);
  }
}

/** Dependencias para ejecutar la lógica del job de perfiles (summary, embedding, bio) para un usuario. */
type ProfileJobDeps = {
  matchRepository: SupabaseMatchRepository;
  docLoveHelper: DocLoveHelper;
  generateUserProfile: GenerateUserProfileFromChats;
  userAIProfileRepository: SupabaseUserAIProfileRepository;
  embeddingService: UserAIProfileEmbeddingService;
  bioGenerationService: UserBioGenerationService;
};

/**
 * Ejecuta para un usuario la misma lógica que process-user-profiles-job (Proceso 1):
 * lee conversaciones no procesadas, genera/actualiza summary en user_ai_profiles,
 * genera embedding en summary_embedding y bio en users.bio.
 */
async function runProfileJobForUser(
  deps: ProfileJobDeps,
  userId: string,
  userName: string
): Promise<void> {
  const {
    matchRepository,
    docLoveHelper,
    generateUserProfile,
    userAIProfileRepository,
    embeddingService,
    bioGenerationService,
  } = deps;

  let docLoveId: string | undefined;
  try {
    docLoveId = await docLoveHelper.getDocLoveUserId();
  } catch {
    docLoveId = undefined;
  }

  const activeChatsWithRealUsers = await matchRepository.getActiveChatsWithRealUsersCount(
    userId,
    docLoveId ? [docLoveId] : undefined
  );
  if (activeChatsWithRealUsers >= 1) {
    console.log(`   ⏭️  Perfil: usuario tiene ${activeChatsWithRealUsers} chat(s) con usuarios reales, omitiendo`);
    return;
  }

  const result = await generateUserProfile.execute(userId);
  if (!result.success) {
    console.error(`   ❌ Perfil: error generando perfil para ${userName}:`, result.error.message);
    return;
  }
  if (result.data === 'No unprocessed chats to analyze') {
    console.log(`   ⏭️  Perfil: sin chats sin procesar para ${userName}`);
    return;
  }

  try {
    const profileAfterResult = await userAIProfileRepository.findByUserId(userId);
    const summaryAfter =
      profileAfterResult.success && profileAfterResult.data
        ? profileAfterResult.data.summary
        : null;
    const summaryAfterContent = summaryAfter?.trim() || null;
    const hasSummary = summaryAfterContent !== null && summaryAfterContent.length > 0;

    if (hasSummary) {
      await embeddingService.generateEmbeddingFromSummary(userId);
      console.log(`   ✅ Perfil: summary y embedding generados para ${userName}`);
      await bioGenerationService.generateBioFromSummary(userId);
      console.log(`   ✅ Perfil: bio generada para ${userName}`);
    } else {
      console.log(`   ⏭️  Perfil: sin summary consolidado para ${userName}`);
    }
  } catch (err) {
    console.warn(
      `   ⚠️  Perfil: error en embedding/bio para ${userName}:`,
      err instanceof Error ? err.message : err
    );
  }
}

async function createUsers() {
  console.log('🚀 Iniciando creación de usuarios...\n');
  console.log(`📊 Total de usuarios a crear: ${CONFIGS_TO_CREATE.length}\n`);
  console.log('📋 Configuración común del perfil:');
  console.log(`   Ubicación: ${PROFILE_CONFIG.location}`);
  console.log(`   País: ${PROFILE_CONFIG.country}`);
  console.log(`   Rango de edad: ${PROFILE_CONFIG.min_age}-${PROFILE_CONFIG.max_age}`);
  console.log(`   Tiene hijos: ${PROFILE_CONFIG.has_children}`);
  console.log(`   Quiere hijos: ${PROFILE_CONFIG.wants_children}`);
  console.log(`   Fuma: ${PROFILE_CONFIG.smoking}`);
  console.log('');

  // Inicializar servicios (una sola vez para todos los usuarios)
  const authService = new SupabaseAuthService();
  const adminClient = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const supabaseConfig = {
    url: supabaseUrl!,
    serviceRoleKey: supabaseServiceRoleKey!,
  };

  const docLoveHelper = new DocLoveHelper(supabaseConfig);
  const likeRepository = new SupabaseLikeRepository(supabaseConfig);
  const matchRepository = new SupabaseMatchRepository(supabaseConfig);
  const messageRepository = new SupabaseMessageRepository(supabaseConfig);
  const userRepository = new SupabaseUserRepository(supabaseConfig);
  const userAIProfileRepository = new SupabaseUserAIProfileRepository(supabaseConfig);

  const systemUserService = new SystemUserService(
    docLoveHelper,
    likeRepository,
    matchRepository,
    messageRepository
  );

  // Logger para el job de perfiles (mismo flujo que process-user-profiles-job)
  const profileJobLogger = {
    debug: (...args: unknown[]) => console.log('[profile]', ...args),
    info: (...args: unknown[]) => console.log('[profile]', ...args),
    warn: (...args: unknown[]) => console.warn('[profile]', ...args),
    error: (...args: unknown[]) => console.error('[profile]', ...args),
  };
  const getUnprocessedMessages = new GetUnprocessedMessages(
    messageRepository,
    matchRepository
  );
  const getAllUserChats = new GetAllUserChats(
    matchRepository,
    userRepository,
    getUnprocessedMessages,
    messageRepository,
    docLoveHelper,
    profileJobLogger
  );
  const generateUserProfile = new GenerateUserProfileFromChats(
    getAllUserChats,
    userAIProfileRepository,
    userRepository,
    profileJobLogger
  );
  const embeddingService = new UserAIProfileEmbeddingService(
    userAIProfileRepository,
    profileJobLogger
  );
  const bioGenerationService = new UserBioGenerationService(
    userAIProfileRepository,
    userRepository,
    profileJobLogger
  );
  const profileJobDeps: ProfileJobDeps = {
    matchRepository,
    docLoveHelper,
    generateUserProfile,
    userAIProfileRepository,
    embeddingService,
    bioGenerationService,
  };

  // Crear usuarios uno por uno
  const createdUsers: CreatedUser[] = [];
  const failedUsers: string[] = [];

  for (let i = 0; i < CONFIGS_TO_CREATE.length; i++) {
    const userConfig = CONFIGS_TO_CREATE[i];
    if (!userConfig) {
      continue;
    }

    console.log(`\n[${i + 1}/${CONFIGS_TO_CREATE.length}] Procesando usuario...`);
    
    const result = await createSingleUser(
      userConfig,
      PROFILE_CONFIG,
      authService,
      adminClient,
      systemUserService,
      messageRepository
    );

    if (result) {
      createdUsers.push(result);

      // Subir fotos de perfil desde fotos_perfiles/{1..20} (usuario 1 → carpeta 1, usuario 2 → carpeta 2, …)
      try {
        const folderNumber = i + 1;
        await uploadProfilePhotosForUser(supabaseConfig, result.id, folderNumber);
      } catch (photoError) {
        console.error(
          `   ❌ Error subiendo fotos de perfil para ${result.name} (carpeta ${i + 1}):`,
          photoError instanceof Error ? photoError.message : photoError
        );
      }

      // Fase de verificación conceptual: comprobar estado coherente y elegibilidad para el job de perfil
      try {
        const verificationDeps: VerificationDeps = {
          adminClient,
          messageRepository,
          matchRepository,
          docLoveHelper,
        };
        const verificationResult = await runVerificationForUser(
          result.id,
          result.name,
          verificationDeps
        );
        logVerificationResult(verificationResult);
      } catch (verificationError) {
        console.error(
          `   ❌ Error en la verificación para ${result.name} (${result.id}):`,
          verificationError
        );
      }

      // Ejecutar lógica del job de perfiles: summary, summary_embedding, users.bio (como process-user-profiles-job)
      try {
        await runProfileJobForUser(profileJobDeps, result.id, result.name);
      } catch (profileJobError) {
        console.error(
          `   ❌ Error en job de perfil para ${result.name}:`,
          profileJobError instanceof Error ? profileJobError.message : profileJobError
        );
      }
    } else {
      failedUsers.push(userConfig.email);
    }

    // Pequeño delay entre usuarios para evitar sobrecargar la base de datos
    if (i < CONFIGS_TO_CREATE.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  // Resumen final
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN FINAL');
  console.log('='.repeat(60));
  console.log(`✅ Usuarios creados exitosamente: ${createdUsers.length}`);
  console.log(`❌ Usuarios fallidos: ${failedUsers.length}`);
  console.log('');

  if (createdUsers.length > 0) {
    console.log('✨ Usuarios creados:');
    createdUsers.forEach((user, index) => {
      console.log(`\n   ${index + 1}. ${user.name} (${user.email})`);
      console.log(`      ID: ${user.id}`);
      if (user.matchId) {
        console.log(`      Match con Doc Love: ${user.matchId}`);
      }
    });
    console.log('');
    console.log('💡 Puedes iniciar sesión con cualquiera de estos usuarios:');
    console.log(`   Password común: ${PROFILE_CONFIG.password}`);
  }

  if (failedUsers.length > 0) {
    console.log('\n⚠️  Usuarios que no se pudieron crear:');
    failedUsers.forEach((email) => {
      console.log(`   - ${email}`);
    });
  }

  if (failedUsers.length > 0) {
    process.exit(1);
  }
}

// Ejecutar script
createUsers()
  .then(() => {
    console.log('\n✅ Script completado');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Error inesperado:', error);
    process.exit(1);
  });
