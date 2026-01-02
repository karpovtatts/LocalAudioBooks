describe('Smoke Test', () => {
  it('should load the app', () => {
    cy.visit('/');
    cy.contains('LocalAudioBooks');
  });
});

