<script setup>
import PublicNavbar from '@/components/PublicNavbar.vue'
import PublicFooter from '@/components/PublicFooter.vue'
import HeroSection from '@/components/landing/HeroSection.vue'
import ProblemSection from '@/components/landing/ProblemSection.vue'
import SolutionSection from '@/components/landing/SolutionSection.vue'
import StepsSection from '@/components/landing/StepsSection.vue'
import FeaturesSection from '@/components/landing/FeaturesSection.vue'
import LevelsSection from '@/components/landing/LevelsSection.vue'
import CtaSection from '@/components/landing/CtaSection.vue'

const navLinks = [
  { label: 'Kenapa SIAP OSN', href: '#kenapa' },
  { label: 'Cara Kerja', href: '#cara-kerja' },
  { label: 'Fitur', href: '#fitur' },
  { label: 'Tingkat Seleksi', href: '#tingkat' },
  { label: 'Tim Kami', href: '#tim' },
]
</script>

<template>
  <div class="lp">
    <PublicNavbar :links="navLinks" current="landing" theme="dark" />
    <HeroSection />
    <ProblemSection />
    <SolutionSection />
    <StepsSection />
    <FeaturesSection />
    <LevelsSection />
    <CtaSection />
    <PublicFooter />
  </div>
</template>
