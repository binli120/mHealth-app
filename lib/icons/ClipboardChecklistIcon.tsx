import React from 'react';
import { IconBase, IconProps } from './IconBase';

export const ClipboardChecklistIcon: React.FC<IconProps> = (props) => (
  <IconBase {...props}>
    <rect x='16' y='10' width='32' height='46' rx='4' />
    <rect x='24' y='6' width='16' height='8' rx='2' />
    <path d='M22 24l3 3 5-5' />
    <path d='M22 34l3 3 5-5' />
    <path d='M22 44l3 3 5-5' />
  </IconBase>
);
