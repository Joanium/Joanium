/**
 * Provider definitions used by the Setup wizard.
 * Each entry describes one AI provider card shown in step 2.
 */
export const PROVIDERS = [
  {
    id: 'anthropic',
    label: 'Claude',
    company: 'Anthropic',
    placeholder: 'sk-ant-api03-...',
    color: '#cc785c',
    iconPath: 'Assets/Icons/Claude.png',
    fallback: 'C',
  },
  {
    id: 'openai',
    label: 'ChatGPT',
    company: 'OpenAI',
    placeholder: 'sk-proj-...',
    color: '#10a37f',
    iconPath: 'Assets/Icons/ChatGPT.png',
    fallback: 'GPT',
  },
  {
    id: 'google',
    label: 'Gemini',
    company: 'Google',
    placeholder: 'AIza...',
    color: '#4285f4',
    iconPath: 'Assets/Icons/Gemini.png',
    fallback: 'G',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    company: '',
    placeholder: 'sk-or-v1-...',
    color: '#9b59b6',
    iconPath: 'Assets/Icons/OpenRouter.png',
    fallback: 'OR',
  },
  {
    id: 'mistral',
    label: 'Mistral',
    company: '',
    placeholder: 'sk-or-v1-...',
    color: '#b6b159ff',
    iconPath: 'Assets/Icons/Mistral.png',
    fallback: 'MI',
  },
  {
    id: 'nvidia',
    label: 'NVIDIA',
    company: 'NVIDIA',
    placeholder: 'nvapi-...',
    color: '#76b900',
    iconPath: 'Assets/Icons/Nvidia.png',
    fallback: 'NV',
  },
];
