import type { Meta, StoryObj } from "@storybook/nextjs"
import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher"

const meta = {
  title: "Shared/LanguageSwitcher",
  component: LanguageSwitcher,
  tags: ["autodocs"],
  parameters: {
    appState: {
      language: "es",
    },
  },
  args: {
    className: "w-[180px]",
  },
} satisfies Meta<typeof LanguageSwitcher>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
