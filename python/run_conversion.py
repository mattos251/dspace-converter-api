#!/usr/bin/env python3
"""
Conversor Central: DSpace 5 -> DSpace 9
Orquestra a conversão completa de input-forms.xml para submission-forms.xml + item-submission.xml

Fluxo:
1. Validar entrada (input-forms.xml exists)
2. Executar forms_converter.py
3. Executar item_submission_converter.py
4. Validar saídas
5. Gerar relatório final
"""

import sys
import traceback
import xml.etree.ElementTree as ET
from pathlib import Path

# Importar conversores
from forms_converter import InputFormsToSubmissionFormsConverter
from item_submission_converter import InputSubmissionToItemSubmissionConverter


class DSpaceConverterOrchestrator:
    """Orquestra a conversão completa de DSpace 5 para DSpace 9"""
    
    def __init__(self, input_forms_path: Path, output_dir: Path, verbose: bool = True):
        self.input_forms_path = input_forms_path
        self.output_dir = output_dir
        self.verbose = verbose
        
        # Arquivos de saída
        self.submission_forms_path = output_dir / "submission-forms.xml"
        self.item_submission_path = output_dir / "item-submission.xml"
        
        # Estatísticas
        self.stats = {
            "step1": {},
            "step2": {},
            "total": {}
        }
    
    def log(self, message: str, level: str = "INFO", prefix: str = "") -> None:
        """Log mensagens de conversão"""
        if self.verbose:
            prefix_str = f"[{prefix}]" if prefix else ""
            print(f"{prefix_str} [{level}] {message}")
    
    def print_header(self, text: str) -> None:
        """Imprime cabeçalho formatado"""
        print(f"\n{'='*70}")
        print(f"  {text}")
        print(f"{'='*70}\n")
    
    def print_step(self, step_num: int, title: str) -> None:
        """Imprime início de um passo"""
        print(f"\n[PASSO {step_num}] {title}")
        print(f"{'-'*70}")
    
    def validate_input(self) -> bool:
        """Valida arquivo de entrada"""
        self.print_step(0, "Validando entrada")
        
        if not self.input_forms_path.exists():
            self.log(f"Arquivo não encontrado: {self.input_forms_path}", "ERROR")
            return False
        
        if not self.input_forms_path.is_file():
            self.log(f"Caminho não é um arquivo: {self.input_forms_path}", "ERROR")
            return False
        
        self.log(f"Arquivo de entrada: {self.input_forms_path}")
        self.log(f"Tamanho: {self.input_forms_path.stat().st_size} bytes")
        self.log(f"Diretório de saída: {self.output_dir}")
        
        return True
    
    def create_output_directory(self) -> bool:
        """Cria diretório de saída se não existir"""
        try:
            self.output_dir.mkdir(parents=True, exist_ok=True)
            self.log(f"Diretório de saída preparado: {self.output_dir}")
            return True
        except Exception as e:
            self.log(f"Erro ao criar diretório: {e}", "ERROR")
            return False
    
    def step1_convert_submission_forms(self) -> bool:
        """
        PASSO 1: Converter input-forms.xml -> submission-forms.xml
        
        Responsabilidade:
        - Converte <page> para <row>
        - Normaliza input-types
        - Adiciona atributos novos
        - Garante estrutura de campos
        """
        self.print_step(1, "Convertendo submission-forms.xml")
        
        try:
            converter = InputFormsToSubmissionFormsConverter(verbose=self.verbose)
            self.log("Iniciando conversão de formulários...")
            
            stats = converter.convert(self.input_forms_path, self.submission_forms_path)
            
            self.stats["step1"] = stats
            
            self.log(f"[OK] Formulários convertidos: {stats['forms_converted']}")
            self.log(f"[OK] Campos convertidos: {stats['fields_converted']}")
            self.log(f"[OK] Arquivo gerado: {stats['output_file']}")
            
            return True
        
        except Exception as e:
            self.log(f"Erro na conversão de submission-forms: {e}", "ERROR")
            self.log(traceback.format_exc(), "ERROR")
            return False
    
    def step2_convert_item_submission(self) -> bool:
        """
        PASSO 2: Converter input-forms.xml -> item-submission.xml
        
        Responsabilidade:
        - Converte form-map em submission-map
        - Cria step-definitions para cada formulário
        - Gera submission-processes
        - Adiciona passos padrão (collection, upload, license)
        """
        self.print_step(2, "Convertendo item-submission.xml")
        
        try:
            converter = InputSubmissionToItemSubmissionConverter(verbose=self.verbose)
            self.log("Iniciando conversão de processes...")
            
            stats = converter.convert(
                self.submission_forms_path,
                self.input_forms_path,
                self.item_submission_path
            )
            
            self.stats["step2"] = stats
            
            self.log(f"[OK] Formulários processados: {stats['forms_processed']}")
            self.log(f"[OK] Mapeamentos de collection: {stats['collection_mappings']}")
            self.log(f"[OK] Arquivo gerado: {stats['output_file']}")
            
            return True
        
        except Exception as e:
            self.log(f"Erro na conversão de item-submission: {e}", "ERROR")
            self.log(traceback.format_exc(), "ERROR")
            return False
    
    def validate_outputs(self) -> bool:
        """Valida arquivos de saída"""
        self.print_step(3, "Validando saídas")

        success = True

        for output_path in (self.submission_forms_path, self.item_submission_path):
            if not output_path.exists():
                self.log(f"Arquivo não foi criado: {output_path}", "ERROR")
                success = False
                continue

            size = output_path.stat().st_size
            self.log(f"[OK] {output_path.name} criado ({size} bytes)")

            # Tentar parsear
            try:
                ET.parse(output_path)
                self.log(f"[OK] {output_path.name} é XML válido")
            except Exception as e:
                self.log(f"Erro ao validar XML: {e}", "WARNING")

        return success
    
    def print_final_report(self) -> None:
        """Imprime relatório final"""
        self.print_header("CONVERSÃO FINALIZADA!")
        
        print("RESUMO DA CONVERSÃO:")
        print(f"  Arquivo de entrada:      {self.input_forms_path}")
        print(f"  Diretório de saída:      {self.output_dir}")
        print(f"\nARQUIVOS GERADOS:")
        print(f"  [OK] submission-forms.xml   {self.submission_forms_path}")
        print(f"  [OK] item-submission.xml    {self.item_submission_path}")
        
        print(f"\nESTATÍSTICAS:")
        print(f"\n  PASSO 1 - Formulários:")
        print(f"    - Formulários convertidos: {self.stats['step1'].get('forms_converted', 0)}")
        print(f"    • Campos convertidos:      {self.stats['step1'].get('fields_converted', 0)}")
        
        print(f"\n  PASSO 2 - Processos:")
        print(f"    • Formulários processados: {self.stats['step2'].get('forms_processed', 0)}")
        print(f"    • Mapeamentos de collection: {self.stats['step2'].get('collection_mappings', 0)}")
        
        print(f"\nPRÓXIMOS PASSOS:")
        print(f"  1. Revisar os arquivos gerados")
        print(f"  2. Comparar com os modelos em forms_modelo_dspace9/")
        print(f"  3. Testar em ambiente DSpace 9")
        print(f"  4. Fazer ajustes finos se necessário")
        
        print(f"\n{'='*70}\n")
    
    def convert(self) -> bool:
        """Executa conversão completa"""
        self.print_header("DSpace 5 -> DSpace 9 Converter")
        
        # Validar entrada
        if not self.validate_input():
            return False
        
        # Criar diretório de saída
        if not self.create_output_directory():
            return False
        
        # PASSO 1: Converter submission-forms
        if not self.step1_convert_submission_forms():
            return False
        
        # PASSO 2: Converter item-submission
        if not self.step2_convert_item_submission():
            return False
        
        # Validar saídas
        if not self.validate_outputs():
            self.log("Conversão falhou: arquivos de saída ausentes", "ERROR")
            return False
        
        # Relatório final
        self.print_final_report()
        
        return True


def main():
    """Função principal"""
    
    # Padrão: arquivos DSpace 5 a converter ficam em forms-dspace5/
    input_forms_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("forms-dspace5/input-forms.xml")
    output_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("result_normalize_dspace9")
    
    # Criar orquestrador
    orchestrator = DSpaceConverterOrchestrator(
        input_forms_path=input_forms_path,
        output_dir=output_dir,
        verbose=True
    )
    
    # Executar conversão
    try:
        success = orchestrator.convert()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\n\nConversão cancelada pelo usuário.")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nErro fatal: {e}")
        print(traceback.format_exc())
        sys.exit(1)


if __name__ == "__main__":
    main()
