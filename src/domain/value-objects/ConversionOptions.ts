export interface ConversionOptions {
  /** Preserva, como comentários, os campos comentados do input-forms.xml. */
  keepCommentedFields: boolean;
}

export const DEFAULT_CONVERSION_OPTIONS: ConversionOptions = {
  keepCommentedFields: true,
};
